from flask import Flask, request, jsonify, send_from_directory, send_file, make_response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, time, timedelta
from dotenv import load_dotenv
import numpy as np
import cv2
import base64
import os
import io
import pandas as pd
import pickle
import bcrypt
import pytz
import math
import json
import requests

# Load environment variables from .env file
load_dotenv()


# --- Location Logic ---
# Target Location: 17°57'07.2"N 79°43'40.5"E (Testing)
TARGET_LAT = 17.937823
TARGET_LON = 79.848803
ALLOWED_RADIUS_KM = 0.16708  # 167.08 meters
LOCATION_ENFORCEMENT_ENABLED = True  # Set to False to allow attendance from anywhere (testing mode)

def haversine(lat1, lon1, lat2, lon2):
    # Radius of the Earth in km
    R = 6371.0
    
    # Convert latitude and longitude from degrees to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Differences in coordinates
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    # Haversine formula
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance

# --- Face++ (Megvii) Face Recognition System ---
class FaceSystem:
    def __init__(self):
        """Initialize Face++ client"""
        self.api_key = os.getenv('FACEPP_API_KEY')
        self.api_secret = os.getenv('FACEPP_API_SECRET')
        self.api_url = 'https://api-us.faceplusplus.com/facepp/v3'
        self.faceset_id = os.getenv('FACEPP_FACESET_ID', 'attendance-system')
        
        if not self.api_key or not self.api_secret:
            print("WARNING: Face++ credentials not found in environment variables.")
            print("Set FACEPP_API_KEY and FACEPP_API_SECRET to use face recognition.")
            self.models_loaded = False
            return
        
        self.models_loaded = True
        print(f"Face++ client initialized. FaceSet: {self.faceset_id}")

    def check_image_quality(self, img):
        """
        Checks for:
        1. Brightness (Average Pixel Intensity)
        2. Sharpness (Laplacian Variance)
        Returns: (passed: bool, reason: str)
        """
        if img is None:
            return False, "Invalid image"
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 1. Brightness Check
        avg_brightness = np.mean(gray)
        if avg_brightness < 40:
            return False, "Image too dark. Ensure good lighting."
        if avg_brightness > 220:
            return False, "Image too bright. Avoid direct glare."
             
        # 2. Sharpness Check
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if laplacian_var < 50:
            return False, "Image too blurry. Hold still."
             
        return True, "OK"

    def detect_face(self, image_bytes):
        """
        Detect face in image using Face++ API.
        Returns: (face_token: str, faces_list: list)
        """
        if not self.models_loaded:
            return None, []

        try:
            # Validate image locally first
            if isinstance(image_bytes, (bytes, bytearray)):
                file_bytes = np.frombuffer(image_bytes, np.uint8)
            else:
                file_bytes = np.frombuffer(image_bytes.read(), np.uint8)
                
            img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            if img is None:
                return None, []
            
            # Quality check
            passed, reason = self.check_image_quality(img)
            if not passed:
                print(f"Quality Check: {reason}")
                # Continue anyway - Face++ will validate further
            
            # Detect face using Face++ API
            files = {'image_file': io.BytesIO(file_bytes)}
            data = {
                'api_key': self.api_key,
                'api_secret': self.api_secret,
                'return_attributes': 'gender,age,smiling,headpose,facequality'
            }
            
            response = requests.post(f"{self.api_url}/detect", files=files, data=data)
            result = response.json()
            
            if not result.get('faces') or len(result['faces']) == 0:
                return None, []
            
            # Return largest face (by face_rectangle area)
            largest_face = max(result['faces'], 
                             key=lambda f: f['face_rectangle']['width'] * f['face_rectangle']['height'])
            
            return largest_face['face_token'], result['faces']
            
        except Exception as e:
            print(f"Error detecting face: {e}")
            return None, []

    def register_face_for_user(self, image_bytes, user_id):
        """
        Register a face for a user by adding it to FaceSet.
        Returns: (success: bool, face_token: str, message: str)
        """
        if not self.models_loaded:
            return False, None, "Face++ not initialized"

        try:
            # Detect face
            face_token, _ = self.detect_face(image_bytes)
            if face_token is None:
                return False, None, "No face detected in image"
            
            # Add to FaceSet
            data = {
                'api_key': self.api_key,
                'api_secret': self.api_secret,
                'outer_id': self.faceset_id,
                'face_tokens': face_token,
                'user_id': user_id  # Track which user owns this face
            }
            
            response = requests.post(f"{self.api_url}/faceset/addface", data=data)
            result = response.json()
            
            if result.get('fail_count', 0) > 0:
                return False, None, f"Failed to add face to FaceSet"
            
            print(f"Added face token {face_token} for user {user_id}")
            return True, face_token, f"Face registered for {user_id}"
            
        except Exception as e:
            print(f"Error registering face: {e}")
            return False, None, f"Failed to register face: {str(e)}"

    def search_face(self, image_bytes, confidence_threshold=0.75):
        """
        Search for a face in the FaceSet.
        Returns: (user_id: str, confidence: float, face_token: str)
        """
        if not self.models_loaded:
            return None, 0, None

        try:
            # Detect face in scan image
            face_token, _ = self.detect_face(image_bytes)
            if face_token is None:
                return None, 0, None
            
            # Search in FaceSet
            data = {
                'api_key': self.api_key,
                'api_secret': self.api_secret,
                'outer_id': self.faceset_id,
                'face_token': face_token,
                'max_user_num': 1  # Get best match only
            }
            
            response = requests.post(f"{self.api_url}/search", data=data)
            result = response.json()
            
            if not result.get('results') or len(result['results']) == 0:
                return None, 0, face_token
            
            # Get best match
            best_match = result['results'][0]
            user_id = best_match.get('user_id')
            confidence = best_match['confidence'] / 100.0  # Convert to 0-1 scale
            
            if confidence >= confidence_threshold:
                return user_id, confidence, face_token
            
            return None, confidence, face_token
            
        except Exception as e:
            print(f"Error searching face: {e}")
            return None, 0, None

# Initialize Face++ recognizer
face_system = FaceSystem()

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app, 
     origins=['*'],  # Allow all origins (mobile apps and browsers)
     supports_credentials=True,
     expose_headers=[
         'Content-Disposition', 
         'Content-Type', 
         'Content-Length',
         'Access-Control-Allow-Origin',
         'Access-Control-Allow-Headers',
         'Access-Control-Allow-Methods'
     ],
     allow_headers=[
         'Content-Type',
         'Authorization',
         'Accept',
         'ngrok-skip-browser-warning'
     ],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

# 🔴 CRITICAL: Handle ngrok browser warning bypass
@app.before_request
def handle_ngrok_preflight():
    """Handle ngrok OPTIONS preflight requests gracefully"""
    if request.method == 'OPTIONS':
        print(f"[CORS] OPTIONS preflight from: {request.origin}")
        response = make_response()
        response.headers['Access-Control-Allow-Origin'] = request.origin if request.origin else '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept, ngrok-skip-browser-warning'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.status_code = 200
        return response

# Database Configuration
# Use Environment Variable for DB URI if available, else fallback to SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///face_attendance.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ----------------- MODELS -----------------

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), unique=True, nullable=False) # e.g., EMP001
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=True, unique=True)
    role = db.Column(db.String(20), nullable=False) # 'admin', 'faculty', 'student'
    is_active = db.Column(db.Boolean, default=True) # For admin deactivation
    # Adjusted to store a LIST of encodings now
    face_encoding = db.Column(db.PickleType, nullable=True) 
    face_registered_at = db.Column(db.DateTime, nullable=True) # When face was registered
    registration_date = db.Column(db.DateTime, default=datetime.utcnow)
    last_active = db.Column(db.DateTime, nullable=True) # For tracking admin activity
    password_hash = db.Column(db.String(128), nullable=True) # Hashed
    # Helper to check password
    def check_password(self, password):
        if not self.password_hash: return False
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

class AttendanceLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), db.ForeignKey('user.user_id'), nullable=False)
    date = db.Column(db.String(20), nullable=False) # Format YYYY-MM-DD
    time_in = db.Column(db.String(20), nullable=True) # Format HH:MM:SS (Local)
    time_out = db.Column(db.String(20), nullable=True) # Format HH:MM:SS (Local)
    check_in_status = db.Column(db.String(30), nullable=True) # P/LP/Absent/HD/EP
    check_out_status = db.Column(db.String(30), nullable=True) # FD/HD/etc
    check_in_period = db.Column(db.String(40), nullable=True)
    check_out_period = db.Column(db.String(40), nullable=True)
    timestamp_in = db.Column(db.DateTime, default=datetime.utcnow) # UTC for cooldown calc
    timestamp_out = db.Column(db.DateTime, nullable=True) # UTC
    status = db.Column(db.String(20), nullable=False) # 'On-Time', 'Late', etc.

class PermissionRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), db.ForeignKey('user.user_id'), nullable=False)
    type = db.Column(db.String(10), nullable=False) # 'EP' (Early Permission), 'LP' (Late Permission)
    date = db.Column(db.String(20), nullable=False)
    start_time = db.Column(db.String(10), nullable=True) # HH:MM
    end_time = db.Column(db.String(10), nullable=True) # HH:MM
    is_full_day = db.Column(db.Boolean, default=False)
    custom_days = db.Column(db.String(400), nullable=True) # CSV dates: YYYY-MM-DD,YYYY-MM-DD
    reason = db.Column(db.String(200))
    status = db.Column(db.String(20), default='Pending') # 'Pending', 'Approved', 'Rejected'

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.String(50), nullable=False)
    action = db.Column(db.String(200), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    reason = db.Column(db.String(200))

class Holiday(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(20), unique=True, nullable=False) # YYYY-MM-DD
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), default="Public Holiday")

class LivePresence(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), db.ForeignKey('user.user_id'), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    distance_m = db.Column(db.Float, nullable=True)
    in_bounds = db.Column(db.Boolean, default=False)
    status_code = db.Column(db.String(50), default='UNKNOWN')
    status_message = db.Column(db.String(300), nullable=True)
    source = db.Column(db.String(30), default='heartbeat')
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)

class SecurityAlert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), nullable=True)
    user_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    event_code = db.Column(db.String(60), nullable=False)
    event_message = db.Column(db.String(300), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AdminAuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(50), nullable=False) # 'admin_created', 'admin_deleted', etc.
    admin_id = db.Column(db.String(50), nullable=False) # Admin who performed the action
    target_id = db.Column(db.String(50), nullable=True) # User being acted upon
    description = db.Column(db.String(300), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class LocationLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), db.ForeignKey('user.user_id'), nullable=False)
    date = db.Column(db.String(20), nullable=False)  # YYYY-MM-DD
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    distance_m = db.Column(db.Float, nullable=False)  # Distance from target in meters
    in_bounds = db.Column(db.Boolean, nullable=False)  # Whether within allowed radius
    network_status = db.Column(db.String(20), default='online')  # 'online' or 'offline'
    accuracy_m = db.Column(db.Float, nullable=True)  # GPS accuracy in meters
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)  # When the location was captured
    
    # Index for fast queries
    __table_args__ = (
        db.Index('idx_user_date_timestamp', 'user_id', 'date', 'timestamp'),
    )

# ----------------- TIME LOGIC HELPER -----------------

ABSENCE_STATUSES = {"Absent", "Didn't Mark"}


def is_absence_status(status):
    return (status or "").strip() in ABSENCE_STATUSES


def has_approved_permission(user_id, date_str, permission_type):
    approved_requests = PermissionRequest.query.filter_by(
        user_id=user_id,
        type=permission_type,
        status='Approved'
    ).all()

    for req in approved_requests:
        if req.date == date_str:
            return True
        if req.custom_days:
            custom_days = [d.strip() for d in req.custom_days.split(',') if d.strip()]
            if date_str in custom_days:
                return True

    return False


def normalize_custom_days(custom_days_raw):
    if custom_days_raw is None:
        return ""

    if isinstance(custom_days_raw, list):
        raw_days = [str(d).strip() for d in custom_days_raw]
    else:
        raw_days = [d.strip() for d in str(custom_days_raw).split(',')]

    valid_days = []
    for day in raw_days:
        if not day:
            continue
        try:
            datetime.strptime(day, '%Y-%m-%d')
            valid_days.append(day)
        except ValueError:
            continue

    return ','.join(sorted(set(valid_days)))


def normalize_time_hhmm(raw_time):
    if not raw_time:
        return None
    raw_time = str(raw_time).strip()
    for fmt in ('%H:%M', '%H:%M:%S'):
        try:
            parsed = datetime.strptime(raw_time, fmt)
            return parsed.strftime('%H:%M')
        except ValueError:
            continue
    return None


def ensure_permission_request_schema():
    """Ensure new PermissionRequest columns exist for older SQLite databases."""
    with db.engine.connect() as conn:
        cols = conn.exec_driver_sql("PRAGMA table_info(permission_request)").fetchall()
        col_names = {c[1] for c in cols}

        if 'start_time' not in col_names:
            conn.exec_driver_sql("ALTER TABLE permission_request ADD COLUMN start_time VARCHAR(10)")
        if 'end_time' not in col_names:
            conn.exec_driver_sql("ALTER TABLE permission_request ADD COLUMN end_time VARCHAR(10)")
        if 'is_full_day' not in col_names:
            conn.exec_driver_sql("ALTER TABLE permission_request ADD COLUMN is_full_day BOOLEAN DEFAULT 0")
        if 'custom_days' not in col_names:
            conn.exec_driver_sql("ALTER TABLE permission_request ADD COLUMN custom_days VARCHAR(400)")


def ensure_attendance_log_schema():
    """Ensure new AttendanceLog columns exist for older SQLite databases."""
    with db.engine.connect() as conn:
        cols = conn.exec_driver_sql("PRAGMA table_info(attendance_log)").fetchall()
        col_names = {c[1] for c in cols}

        if 'check_in_status' not in col_names:
            conn.exec_driver_sql("ALTER TABLE attendance_log ADD COLUMN check_in_status VARCHAR(30)")
        if 'check_out_status' not in col_names:
            conn.exec_driver_sql("ALTER TABLE attendance_log ADD COLUMN check_out_status VARCHAR(30)")
        if 'check_in_period' not in col_names:
            conn.exec_driver_sql("ALTER TABLE attendance_log ADD COLUMN check_in_period VARCHAR(40)")
        if 'check_out_period' not in col_names:
            conn.exec_driver_sql("ALTER TABLE attendance_log ADD COLUMN check_out_period VARCHAR(40)")


def require_active_admin(admin_id):
    if not admin_id:
        return None
    return User.query.filter_by(user_id=admin_id, role='admin', is_active=True).first()


@app.route('/api/permissions/request', methods=['POST'])
def blocked_permission_request():
    """Faculty cannot request permissions through website; they must approach admin directly."""
    return jsonify({
        "success": False,
        "message": "Permission requests are admin-controlled. Meet admin directly for late/early/medical approvals."
    }), 403


def classify_first_mark(scan_dt):
    """Return first-mark status for the day based on configured time windows."""
    t = scan_dt.time()

    if t < time(9, 0):
        return {
            "allowed": False,
            "status": None,
            "period": "00:00-09:00",
            "message": "Attendance is not taken between 12:00 AM and 9:00 AM."
        }
    if t < time(9, 35):
        return {"allowed": True, "status": "Present", "period": "09:00-09:35", "message": "Check-In: Present"}
    if t < time(10, 30):
        return {"allowed": True, "status": "Late Permission", "period": "09:35-10:30", "message": "Check-In: Late Permission"}
    if t < time(12, 40):
        return {"allowed": True, "status": "Absent", "period": "10:30-12:40", "message": "Check-In: Absent"}
    if t < time(13, 40):
        return {"allowed": True, "status": "HD", "period": "12:40-13:40", "message": "Check-In: Half Day"}
    if t < time(15, 10):
        return {"allowed": True, "status": "Absent", "period": "13:40-15:10", "message": "Check-In: Absent"}
    if t < time(16, 10):
        return {"allowed": True, "status": "EP", "period": "15:10-16:10", "message": "Check-In: Early Permission"}

    return {
        "allowed": False,
        "status": None,
        "period": "16:10-24:00",
        "message": "First marking is closed in evening window. Evening marking is only for second mark."
    }


def classify_second_mark(first_status, scan_dt):
    """Return second-mark final status for the day based on first status and time window."""
    t = scan_dt.time()
    first_status = (first_status or "").strip()

    if time(12, 40) <= t < time(13, 40) and first_status in {"Present", "Late Permission"}:
        return {
            "allowed": True,
            "final_status": "HD",
            "out_status": "HD",
            "period": "12:40-13:40",
            "message": "Check-Out: Half Day"
        }

    if time(16, 10) <= t:
        if first_status in {"Present", "Late Permission"}:
            return {
                "allowed": True,
                "final_status": "FD",
                "out_status": "FD",
                "period": "16:10-24:00",
                "message": "Check-Out: Full Day"
            }

        if first_status in {"Absent", "HD", "EP"}:
            return {
                "allowed": True,
                "final_status": "HD",
                "out_status": "HD",
                "period": "16:10-24:00",
                "message": "Check-Out: Half Day"
            }

        return {
            "allowed": True,
            "final_status": "HD",
            "out_status": "HD",
            "period": "16:10-24:00",
            "message": "Check-Out: Half Day"
        }

    return {
        "allowed": False,
        "final_status": None,
        "out_status": None,
        "period": None,
        "message": "Second mark ignored in this period."
    }

def check_attendance_status(user_id, scan_time, type, late_permission_approved=False):
    """
    Check-In:
      < 09:30: On Time
      09:30 - 09:45: Late Permission
      > 09:45: Absent unless a late permission has been approved
    
    Check-Out:
      < 16:10: Early Permission
      16:10 - 17:00: On Time
      > 17:00: Extended
    """
    
    # Define constraints
    COLLEGE_START = time(9, 30, 0)
    GRACE_END = time(9, 45, 0)
    
    COLLEGE_END = time(16, 10, 0) # 4:10 PM
    EXTENDED_END = time(17, 0, 0) # 5:00 PM

    today_str = scan_time.strftime('%Y-%m-%d')
    scan_time_val = scan_time.time()

    if type == 'IN':
        if scan_time_val < COLLEGE_START:
            return "On Time"
        elif scan_time_val <= GRACE_END:
            return "Late Permission"
        elif late_permission_approved:
            return "Late Permission"
        else:
            return "Absent"

    elif type == 'OUT':
        if scan_time_val < COLLEGE_END:
             return "Early Permission"
        elif scan_time_val <= EXTENDED_END:
             return "On Time"
        else:
             return "Extended"
    
    return "Unknown"


def get_time_policy_flags(local_dt):
    """Return time-window flags used by frontend monitoring and backend enforcement."""
    now_t = local_dt.time()
    return {
        "is_check_in_window": time(9, 0, 0) <= now_t <= time(9, 45, 0),
        "is_lunch_window": time(13, 0, 0) <= now_t <= time(13, 40, 0),
        "is_lunch_pre_alert": time(12, 50, 0) <= now_t < time(13, 0, 0),
        "is_return_pre_alert": time(13, 30, 0) <= now_t < time(13, 40, 0),
        "is_post_lunch_enforcement": time(13, 40, 0) < now_t < time(16, 10, 0),
        "is_check_out_window": time(16, 10, 0) <= now_t <= time(17, 0, 0)
    }


def upsert_live_presence(user, status_code, status_message, source='heartbeat', latitude=None, longitude=None, distance_m=None, in_bounds=False):
    """Create or update current live presence state for a user."""
    presence = LivePresence.query.filter_by(user_id=user.user_id).first()
    previous_status = None

    if not presence:
        presence = LivePresence(
            user_id=user.user_id,
            name=user.name,
            role=user.role
        )
        db.session.add(presence)
    else:
        previous_status = presence.status_code

    presence.name = user.name
    presence.role = user.role
    presence.status_code = status_code
    presence.status_message = status_message
    presence.source = source
    presence.last_seen = datetime.utcnow()
    presence.in_bounds = bool(in_bounds)
    presence.distance_m = distance_m

    if latitude is not None and longitude is not None:
        presence.latitude = latitude
        presence.longitude = longitude

    # Create alert if status is not OK (either new alert or state change)
    # OUT_OF_BOUNDS alerts are created every time to ensure admin always sees current violations
    should_create_alert = (status_code != 'OK') and (previous_status != status_code or status_code == 'OUT_OF_BOUNDS')
    
    if should_create_alert:
        existing_alert = SecurityAlert.query.filter_by(
            user_id=user.user_id,
            event_code=status_code
        ).filter(
            SecurityAlert.created_at >= (datetime.utcnow() - timedelta(minutes=5))
        ).first()
        
        if not existing_alert:
            db.session.add(SecurityAlert(
                user_id=user.user_id,
                user_name=user.name,
                role=user.role,
                event_code=status_code,
                event_message=status_message
            ))
            print(f"DEBUG: SecurityAlert created for {user.user_id}: {status_code} - {status_message}")

def verify_presence_by_location(user_id, date_str, min_location_entries=3):
    """
    Verify if a user has continuous location tracking for a date.
    Returns True if user has at least min_location_entries valid location pings.
    
    This ensures that even if cache is cleared or app crashes,
    the location data proves they were present on campus.
    """
    try:
        location_logs = LocationLog.query.filter_by(
            user_id=user_id,
            date=date_str,
            in_bounds=True
        ).count()
        
        # If at least 3 valid in-bounds location pings, consider them present
        return location_logs >= min_location_entries
    except:
        return False

def get_user_location_history(user_id, date_str):
    """
    Get all location pings for a user on a specific date.
    Used for reporting and verification.
    """
    try:
        logs = LocationLog.query.filter_by(
            user_id=user_id,
            date=date_str
        ).order_by(LocationLog.timestamp.asc()).all()
        
        return [{
            'timestamp': log.timestamp.isoformat(),
            'latitude': log.latitude,
            'longitude': log.longitude,
            'distance_m': log.distance_m,
            'in_bounds': log.in_bounds,
            'accuracy_m': log.accuracy_m
        } for log in logs]
    except:
        return []

def ensure_location_log_table():
    """
    Ensure LocationLog table exists and has required indexes.
    Called when app starts.
    """
    try:
        with app.app_context():
            # Create table if it doesn't exist
            db.create_all()
        print("[DB] LocationLog table verified")
    except Exception as e:
        print(f"[DB ERROR] LocationLog setup failed: {e}")

# Call this on app startup
ensure_location_log_table()

# ----------------- ROUTES -----------------

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# 1. Initialize Database
@app.route('/api/init_db', methods=['POST'])
def init_db():
    try:
        db.drop_all() # Reset
        db.create_all()
        
        # Create Default Admin
        pw_hash = bcrypt.hashpw("admin".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin = User(
            user_id="ADMIN01", 
            name="System Administrator", 
            role="admin", 
            face_encoding=None, 
            password_hash=pw_hash 
        )
        db.session.add(admin)
        db.session.commit()
        
        return jsonify({"message": "Database initialized. Admin created (ID: ADMIN01, Pass: admin)"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 2. Register User (New or Add Face)
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    try:
        # data: name, user_id, role, image (base64). Optional: password (for auth)
        print(f"Registering for {data['user_id']}")
        
        # Decode image
        image_data = base64.b64decode(data['image'].split(',')[1])
        image_bytes = image_data
        
        # Get face encoding and location
        encoding, loc = face_system.get_face_encoding(image_bytes) 
        
        if encoding is None:
            return jsonify({"success": False, "message": "Face quality check failed or no face detected."}), 400

        # Check if user exists
        existing_user = User.query.filter_by(user_id=data['user_id']).first()
        
        if existing_user:
            # Mode: Update Face (Retraining)
            # Security: Verify password if provided, or assume logged in context (simple logic for now)
            # Ideally frontend sends password for sensitive updates
            raw_pw = data.get('password')
            if raw_pw and existing_user.check_password(raw_pw):
                # Append to existing encodings
                current_encodings = existing_user.face_encoding
                if current_encodings is None:
                    current_encodings = []
                elif not isinstance(current_encodings, list):
                    current_encodings = [current_encodings]
                
                # Clone list to ensure SQLAlchemy detects change
                new_encodings_list = list(current_encodings)
                new_encodings_list.append(encoding)
                
                existing_user.face_encoding = new_encodings_list
                
                db.session.commit()
                return jsonify({"success": True, "message": "Face model updated successfully."})
            else:
                 return jsonify({"success": False, "message": "User exists. Password required to update face."}), 401

        else:
            # Mode: New User
            raw_pw = data.get('password', data['user_id'])
            pw_hash = bcrypt.hashpw(raw_pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            new_user = User(
                user_id=data['user_id'],
                name=data['name'],
                role=data['role'],
                password_hash=pw_hash,
                face_encoding=[encoding] # Start list
            )
            
            db.session.add(new_user)
            db.session.commit()
            return jsonify({"success": True, "message": "User registered successfully"})
            
    except Exception as e:
        print(f"Registration Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Simple health check endpoint (no database needed)
@app.route('/api/health', methods=['GET', 'POST', 'OPTIONS'])
def health_check():
    """Simple endpoint to verify backend is running"""
    print("[Health] Connection test from:", request.remote_addr)
    return jsonify({"status": "ok", "message": "Backend is running"}), 200

# Initialize Face++ FaceSet (call this once during setup)
@app.route('/api/init_facepp_faceset', methods=['POST'])
def init_facepp_faceset():
    """Initialize Face++ FaceSet for face recognition"""
    try:
        if not face_system.models_loaded:
            return jsonify({
                "success": False,
                "message": "Face++ not configured. Set FACEPP_API_KEY and FACEPP_API_SECRET environment variables."
            }), 500
        
        faceset_outer_id = face_system.faceset_id
        
        # Try to get existing FaceSet
        try:
            result = requests.post(f"{face_system.api_url}/faceset/getdetail", data={
                'api_key': face_system.api_key,
                'api_secret': face_system.api_secret,
                'outer_id': faceset_outer_id
            })
            
            if result.json().get('face_count') is not None:
                # FaceSet already exists
                return jsonify({
                    "success": True,
                    "message": f"FaceSet '{faceset_outer_id}' already exists",
                    "faceset_id": faceset_outer_id,
                    "face_count": result.json().get('face_count', 0)
                }), 200
        except:
            # FaceSet doesn't exist, will create it
            pass
        
        # Create new FaceSet
        result = requests.post(f"{face_system.api_url}/faceset/create", data={
            'api_key': face_system.api_key,
            'api_secret': face_system.api_secret,
            'outer_id': faceset_outer_id,
            'display_name': 'Attendance System FaceSet'
        })
        
        response = result.json()
        if response.get('face_count') is not None or response.get('faceset_id'):
            print(f"Created FaceSet: {faceset_outer_id}")
            return jsonify({
                "success": True,
                "message": f"FaceSet '{faceset_outer_id}' created successfully",
                "faceset_id": faceset_outer_id
            }), 201
        else:
            return jsonify({
                "success": False,
                "message": f"Failed to create FaceSet: {response.get('error_message', 'Unknown error')}"
            }), 500
        
    except Exception as e:
        print(f"Error initializing FaceSet: {e}")
        return jsonify({
            "success": False,
            "message": f"Failed to initialize FaceSet: {str(e)}"
        }), 500

# 3. Login (Credentials) - Auto-detect role from database
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(user_id=data['username']).first()
    
    if user and user.check_password(data['password']):
        # Check if admin account is deactivated
        if user.role == 'admin' and not user.is_active:
            return jsonify({"success": False, "message": "Your admin account has been deactivated. Contact system administrator."}), 403
        
        # Check if user needs to complete face registration (first login)
        # Faculty: always needs face on first login
        # Admin: needs face on first login (except ADMIN01 demo account)
        needs_face = False
        if user.role == 'faculty' and not user.face_encoding:
            needs_face = True
        elif user.role == 'admin' and not user.face_encoding and user.user_id != 'ADMIN01':
            needs_face = True
             
        return jsonify({
            "success": True, 
            "user": {
                "id": user.user_id,
                "user_id": user.user_id, 
                "name": user.name, 
                "role": user.role
            },
            "needs_face_registration": needs_face
        })
    return jsonify({"success": False, "message": "Invalid Credentials"}), 401

# 3a. Logout - Clear user's live presence and tracking
@app.route('/api/logout', methods=['POST'])
def logout():
    """Clean up user's live presence data on logout"""
    try:
        data = request.json or {}
        user_id = (data.get('user_id') or '').strip()
        
        if not user_id:
            return jsonify({"success": False, "message": "user_id is required"}), 400
        
        # Delete user's LivePresence record
        presence = LivePresence.query.filter_by(user_id=user_id).first()
        if presence:
            db.session.delete(presence)
            db.session.commit()
            print(f"✅ Logout: LivePresence cleared for {user_id}")
        
        return jsonify({
            "success": True,
            "message": f"User {user_id} logged out. Tracking stopped."
        })
    
    except Exception as e:
        print(f"Logout Error: {e}")
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

# 3a-cleanup. Auto-cleanup stale presence records (older than 1 hour)
def cleanup_stale_presence():
    """Remove LivePresence records older than 1 hour (background task)"""
    try:
        stale_cutoff = datetime.utcnow() - timedelta(hours=1)
        stale_records = LivePresence.query.filter(
            LivePresence.last_seen < stale_cutoff
        ).all()
        
        count = len(stale_records)
        for record in stale_records:
            db.session.delete(record)
        
        if count > 0:
            db.session.commit()
            print(f"🧹 Cleanup: Removed {count} stale LivePresence records older than 1 hour")
    except Exception as e:
        print(f"Cleanup Error: {e}")
        db.session.rollback()

# 3b. Register Faculty (Admin Only)
@app.route('/api/register_faculty', methods=['POST'])
def register_faculty():
    data = request.json
    admin_id = data.get('admin_id')
    
    try:
        # Verify admin
        admin = User.query.filter_by(user_id=admin_id).first()
        if not admin or admin.role != 'admin':
            return jsonify({"success": False, "message": "Unauthorized. Admin access required."}), 403
        
        # Check if faculty already exists
        if User.query.filter_by(user_id=data['user_id']).first():
            return jsonify({"success": False, "message": "Faculty ID already exists"}), 400
        
        # Create faculty user
        pw_hash = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        new_faculty = User(
            user_id=data['user_id'],
            name=data['name'],
            role='faculty',
            password_hash=pw_hash,
            face_encoding=None  # Faculty must register face on first login
        )
        
        db.session.add(new_faculty)
        db.session.commit()
        
        # Audit log
        audit = AuditLog(
            admin_id=admin_id,
            action=f"Registered new faculty: {data['name']} ({data['user_id']})",
            timestamp=datetime.now(pytz.utc)
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Faculty '{data['name']}' registered successfully. They must capture face on first login.",
            "faculty": {
                "user_id": new_faculty.user_id,
                "name": new_faculty.name,
                "role": new_faculty.role
            }
        })
        
    except Exception as e:
        print(f"Faculty Registration Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# ============================================
# ADMIN MANAGEMENT ENDPOINTS
# ============================================

# 3B. Create Admin (Direct Registration)
@app.route('/api/create_admin', methods=['POST'])
def create_admin():
    """Admin creates another admin directly"""
    try:
        # Verify admin creating the request
        current_user_id = request.json.get('created_by') or 'ADMIN01'  # From auth header in production
        admin_user = User.query.filter_by(user_id=current_user_id, role='admin', is_active=True).first()
        
        if not admin_user:
            return jsonify({"error": "Unauthorized. Only active admins can create new admins."}), 403
        
        data = request.json
        name = data.get('name', '').strip()
        user_id = data.get('user_id', '').strip()
        password = data.get('password', '')
        email = data.get('email', '').strip() if data.get('email') else None
        
        if not all([name, user_id, password]):
            return jsonify({"error": "Name, ID, and password are required"}), 400
        
        # Check if user exists
        if User.query.filter_by(user_id=user_id).first():
            return jsonify({"error": f"Admin ID '{user_id}' already exists"}), 400
        
        if email and User.query.filter_by(email=email).first():
            return jsonify({"error": f"Email '{email}' already in use"}), 400
        
        # Create new admin
        pw_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        new_admin = User(
            user_id=user_id,
            name=name,
            email=email,
            role='admin',
            password_hash=pw_hash,
            is_active=True
        )
        
        db.session.add(new_admin)
        db.session.flush()
        
        # Log action
        audit = AdminAuditLog(
            action='admin_created',
            admin_id=current_user_id,
            target_id=user_id,
            description=f"Admin created: {name} ({user_id})"
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Admin '{name}' created successfully",
            "admin": {
                "user_id": new_admin.user_id,
                "name": new_admin.name,
                "email": new_admin.email,
                "role": "admin",
                "is_active": True
            }
        }), 201
        
    except Exception as e:
        print(f"Create Admin Error: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# 3C. List All Admins
@app.route('/api/list_admins', methods=['GET'])
def list_admins():
    """Get list of all admin accounts"""
    try:
        admins = User.query.filter_by(role='admin').all()
        
        admin_list = [{
            "user_id": admin.user_id,
            "name": admin.name,
            "email": admin.email,
            "is_active": admin.is_active,
            "created_at": admin.registration_date.isoformat() + 'Z' if admin.registration_date else None,
            "last_active": admin.last_active.isoformat() + 'Z' if admin.last_active else None
        } for admin in admins]
        
        return jsonify({"success": True, "admins": admin_list}), 200
        
    except Exception as e:
        print(f"List Admins Error: {e}")
        return jsonify({"error": str(e)}), 500

# 3G. Deactivate Admin
@app.route('/api/deactivate_admin', methods=['POST'])
def deactivate_admin():
    """Deactivate an admin account"""
    try:
        current_user_id = request.json.get('current_user') or 'ADMIN01'
        data = request.json
        target_user_id = data.get('user_id')
        
        if not target_user_id:
            return jsonify({"error": "User ID is required"}), 400
        
        target_admin = User.query.filter_by(user_id=target_user_id, role='admin').first()
        
        if not target_admin:
            return jsonify({"error": "Admin not found"}), 404
        
        target_admin.is_active = False
        
        # Log action
        audit = AdminAuditLog(
            action='admin_deactivated',
            admin_id=current_user_id,
            target_id=target_user_id,
            description=f"Admin deactivated: {target_admin.name}"
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Admin '{target_admin.name}' has been deactivated"
        }), 200
        
    except Exception as e:
        print(f"Deactivate Admin Error: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# 3H. Reactivate Admin
@app.route('/api/reactivate_admin', methods=['POST'])
def reactivate_admin():
    """Reactivate a deactivated admin account"""
    try:
        current_user_id = request.json.get('current_user') or 'ADMIN01'
        data = request.json
        target_user_id = data.get('user_id')
        
        if not target_user_id:
            return jsonify({"error": "User ID is required"}), 400
        
        target_admin = User.query.filter_by(user_id=target_user_id, role='admin').first()
        
        if not target_admin:
            return jsonify({"error": "Admin not found"}), 404
        
        target_admin.is_active = True
        
        # Log action
        audit = AdminAuditLog(
            action='admin_activated',
            admin_id=current_user_id,
            target_id=target_user_id,
            description=f"Admin reactivated: {target_admin.name}"
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Admin '{target_admin.name}' has been reactivated"
        }), 200
        
    except Exception as e:
        print(f"Reactivate Admin Error: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# 3H. Delete Admin (Hard Delete)
@app.route('/api/delete_admin', methods=['POST'])
def delete_admin():
    """Permanently delete an admin account"""
    try:
        current_user_id = request.json.get('current_user') or 'ADMIN01'
        admin_user = User.query.filter_by(user_id=current_user_id, role='admin', is_active=True).first()
        
        if not admin_user:
            return jsonify({"error": "Unauthorized. Only active admins can delete users."}), 403
        
        target_user_id = request.json.get('user_id', '').strip()
        
        if not target_user_id:
            return jsonify({"error": "User ID is required"}), 400
        
        # Prevent self-deletion
        if target_user_id == current_user_id:
            return jsonify({"error": "Cannot delete your own account"}), 400
        
        target_admin = User.query.filter_by(user_id=target_user_id, role='admin').first()
        
        if not target_admin:
            return jsonify({"error": "Admin not found"}), 404
        
        # Store info for audit log before deletion
        target_name = target_admin.name
        target_email = target_admin.email
        
        # Delete the admin
        db.session.delete(target_admin)
        
        # Log action
        audit = AdminAuditLog(
            action='admin_deleted',
            admin_id=current_user_id,
            target_id=target_user_id,
            description=f"Admin permanently deleted: {target_name} ({target_email})"
        )
        db.session.add(audit)
        db.session.commit()
        
        print(f"✅ Admin deleted: {target_name} (ID: {target_user_id})")
        
        return jsonify({
            "success": True,
            "message": f"Admin '{target_name}' has been permanently deleted"
        }), 200
        
    except Exception as e:
        print(f"Delete Admin Error: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# 3I. Admin Audit Log
@app.route('/api/admin_audit_log', methods=['GET'])
def admin_audit_log():
    """Get admin activity audit log"""
    try:
        logs = AdminAuditLog.query.order_by(AdminAuditLog.created_at.desc()).limit(50).all()
        
        log_list = [{
            "action": log.action,
            "admin_id": log.admin_id,
            "target_id": log.target_id,
            "description": log.description,
            "created_at": log.created_at.isoformat() + 'Z'
        } for log in logs]
        
        return jsonify({"success": True, "logs": log_list}), 200
        
    except Exception as e:
        print(f"Audit Log Error: {e}")
        return jsonify({"error": str(e)}), 500

# 3B. Register Face - Multi-Angle Capture
@app.route('/api/register_face_multi_angle', methods=['POST'])
def register_face_multi_angle():
    data = request.json
    user_id = data.get('user_id')
    face_images = data.get('face_images')  # Dict: {'front': base64, 'left': base64, ...}
    
    try:
        # Verify user exists
        user = User.query.filter_by(user_id=user_id).first()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        if not face_images or len(face_images) < 5:
            return jsonify({"success": False, "message": "All 5 angles required"}), 400
        
        # Process all angles and register with Face++
        face_tokens = []
        angles_processed = []
        failed_angles = []
        
        for angle, base64_image in face_images.items():
            try:
                # Decode base64 image
                image_data = base64_image.split(',')[1] if ',' in base64_image else base64_image
                image_bytes = base64.b64decode(image_data)
                
                # Register face with Face++
                success, face_token, message = face_system.register_face_for_user(image_bytes, user_id)
                
                if success and face_token:
                    face_tokens.append(face_token)
                    angles_processed.append(angle)
                    print(f"Successfully registered {angle} angle for {user_id}")
                else:
                    failed_angles.append((angle, message))
                    print(f"Failed to register {angle} angle: {message}")
                    
            except Exception as e:
                failed_angles.append((angle, str(e)))
                print(f"Error processing {angle} image: {e}")
        
        # Need at least 3 valid angles for reliable recognition
        if len(face_tokens) < 3:
            return jsonify({
                "success": False,
                "message": f"Only {len(face_tokens)} angles processed successfully. Need at least 3.",
                "details": {
                    "processed": angles_processed,
                    "failed": failed_angles
                }
            }), 400
        
        # Update user's face registration timestamp
        user.face_registered_at = datetime.now(pytz.utc)
        # Store face tokens as comma-separated string
        user.face_encoding = ','.join(face_tokens)
        db.session.commit()
        
        # Audit log
        audit = AuditLog(
            admin_id='SYSTEM',
            action=f"User {user_id} registered face with {len(face_tokens)} angles (Face++): {', '.join(angles_processed)}",
            timestamp=datetime.now(pytz.utc)
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Face registered successfully using {len(face_tokens)} angles",
            "angles_used": angles_processed,
            "face_tokens": len(face_tokens)
        })
        
    except Exception as e:
        print(f"Multi-Angle Face Registration Error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# 4. Recognize Face (For Login or Attendance)
@app.route('/api/recognize', methods=['POST'])
def recognize():
    data = request.json
    try:
        if 'image' not in data:
            return jsonify({
                "success": False,
                "error_code": "NO_IMAGE",
                "message": "No camera image was received. Please try scanning again."
            }), 400

        # Decode image
        image_data = base64.b64decode(data['image'].split(',')[1])
        image_bytes = image_data
        
        # Search for face in FaceSet using Face++
        matched_user_id, confidence, face_token = face_system.search_face(image_bytes, confidence_threshold=0.75)
        
        if matched_user_id is None:
            db.session.add(SecurityAlert(
                user_id=None,
                user_name='Unknown Face',
                role='unknown',
                event_code='INVALID_USER_SCAN',
                event_message='Unregistered or invalid user attempted face scan.'
            ))
            db.session.commit()
            return jsonify({
                "success": False,
                "error_code": "INVALID_USER",
                "message": "Invalid user or unregistered face. Please contact admin if you are a valid staff member."
            }), 401
        
        # Look up user in database
        user = User.query.filter_by(user_id=matched_user_id).first()
        if not user:
            return jsonify({
                "success": False,
                "error_code": "USER_NOT_FOUND",
                "message": "User record not found in database."
            }), 404
        
        # Get face location for response (approximate from face_token info)
        face_location = {
            "face_token": face_token,
            "confidence": round(confidence * 100, 2)  # Return as percentage
        }
        
        # --- Location Check (Only for Registered Users) ---
        user_loc = data.get('location')
        if not user_loc or not isinstance(user_loc, dict):
            return jsonify({
                "success": False,
                "error_code": "LOCATION_REQUIRED",
                "message": "Location access is required. Please enable GPS and allow location permission."
            }), 400
        
        try:
            user_lat = float(user_loc.get('latitude'))
            user_lon = float(user_loc.get('longitude'))
            
            dist = haversine(user_lat, user_lon, TARGET_LAT, TARGET_LON)
            print(f"DEBUG: User Loc: ({user_lat}, {user_lon}) | Target: ({TARGET_LAT}, {TARGET_LON}) | Dist: {dist*1000:.2f}m")

            # If location enforcement is enabled, enforce boundary check
            if LOCATION_ENFORCEMENT_ENABLED and dist > ALLOWED_RADIUS_KM:
                return jsonify({
                    "success": False, 
                    "error_code": "OUT_OF_BOUNDS",
                    "message": f"Out of campus boundary. You are {dist:.2f} km away. Move inside {ALLOWED_RADIUS_KM*1000:.0f} m and scan again."
                }), 403
                 
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "error_code": "LOCATION_INVALID",
                "message": "Invalid location coordinates received. Re-enable location and try again."
            }), 400
        
        # Auto-Mark Attendance if recognized
        # Use UTC for storage, Local for logic
        now_utc = datetime.now(pytz.utc)
        local_tz = pytz.timezone('Asia/Kolkata')
        now_local = now_utc.astimezone(local_tz)
        
        today_str = now_local.strftime('%Y-%m-%d')
        time_str = now_local.strftime('%H:%M:%S')

        # --- Holiday Check ---
        holiday = Holiday.query.filter_by(date=today_str).first()
        if holiday:
            return jsonify({
                "success": True, 
                "user": {
                    "id": user.user_id,
                    "user_id": user.user_id,
                    "name": user.name,
                    "role": user.role
                },
                "location": face_location,
                "attendance": { "status": f"Holiday: {holiday.name}", "type": "HOLIDAY" }
            })

        # Check if already checked in today (Debounce logic)
        today_log = AttendanceLog.query.filter_by(user_id=user.user_id, date=today_str).first()
        
        log_type = 'IN'
        msg = "Marked Present"
        
        if today_log:
            if today_log.time_out:
                msg = "Attendance Complete"
                log_type = "already_done"
            
            else:
                # Has checked IN, now checking OUT (if cooldown passes)
                min_gap = 10 
                
                time_diff = (now_utc.replace(tzinfo=None) - today_log.timestamp_in).total_seconds()
                
                if time_diff < min_gap: 
                    msg = f"Wait {int(min_gap-time_diff)}s to Checkout"
                    log_type = "cooldown" 
                else:
                    second = classify_second_mark(today_log.check_in_status or today_log.status, now_local)
                    if not second["allowed"]:
                        log_type = "ignored"
                        msg = second["message"]
                    else:
                        log_type = 'OUT'
                        today_log.time_out = time_str
                        today_log.timestamp_out = now_utc
                        today_log.check_out_status = second["out_status"]
                        today_log.check_out_period = second["period"]
                        today_log.status = second["final_status"]
                        db.session.commit()
                        msg = second["message"]
        else:
            first = classify_first_mark(now_local)
            if not first["allowed"]:
                return jsonify({
                    "success": True,
                    "user": {
                        "id": user.user_id,
                        "user_id": user.user_id,
                        "name": user.name,
                        "role": user.role
                    },
                    "location": face_location,
                    "attendance": {
                        "status": first["message"],
                        "type": "IGNORED"
                    }
                })

            new_log = AttendanceLog(
                user_id=user.user_id,
                date=today_str,
                time_in=time_str,
                time_out=None,
                check_in_status=first["status"],
                check_in_period=first["period"],
                check_out_status=None,
                check_out_period=None,
                timestamp_in=now_utc,
                status=first["status"]
            )
            db.session.add(new_log)
            db.session.commit()
            msg = first["message"]
            log_type = 'IN'

        return jsonify({
            "success": True, 
            "user": {
                "id": user.user_id, 
                "user_id": user.user_id,
                "name": user.name, 
                "role": user.role
            },
            "location": face_location, 
            "attendance": {
                "status": msg,
                "type": log_type
            }
        })

    except Exception as e:
        print(f"Recognition Error: {e}")
        return jsonify({
            "success": False,
            "error_code": "SERVER_ERROR",
            "message": "Server error while validating attendance. Please retry in a moment.",
            "error": str(e)
        }), 500

@app.route('/api/location_heartbeat', methods=['POST'])
def location_heartbeat():
    """
    Receives periodic location pings from logged-in mobile users.
    Enforces lunch-window boundary policy and returns alert hints for frontend.
    """
    data = request.json or {}
    user_id = data.get('user_id')
    user_loc = data.get('location')
    device_status = data.get('device_status') or {}

    if not user_id:
        return jsonify({"success": False, "message": "user_id is required"}), 400

    user = User.query.filter_by(user_id=user_id).first()
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    network_on = bool(device_status.get('network_on', True))
    location_on = bool(device_status.get('location_on', True))

    if not network_on:
        upsert_live_presence(
            user,
            status_code='NETWORK_OFF',
            status_message='Mobile data/Wi-Fi appears OFF for this user.',
            source='heartbeat',
            in_bounds=False
        )
        db.session.commit()
        return jsonify({
            "success": True,
            "in_bounds": False,
            "marked_absent": False,
            "alert": 'Network is OFF for this user. Tracking paused.',
            "alert_code": 'NETWORK_OFF'
        })

    if not location_on:
        upsert_live_presence(
            user,
            status_code='LOCATION_OFF',
            status_message='Location permission/GPS is OFF for this user.',
            source='heartbeat',
            in_bounds=False
        )
        db.session.commit()
        return jsonify({
            "success": True,
            "in_bounds": False,
            "marked_absent": False,
            "alert": 'Location is OFF for this user. Tracking paused.',
            "alert_code": 'LOCATION_OFF'
        })

    if not user_loc or not isinstance(user_loc, dict):
        return jsonify({"success": False, "message": "Valid location payload is required"}), 400

    try:
        user_lat = float(user_loc.get('latitude'))
        user_lon = float(user_loc.get('longitude'))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Invalid coordinates"}), 400

    dist_km = haversine(user_lat, user_lon, TARGET_LAT, TARGET_LON)
    in_bounds = dist_km <= ALLOWED_RADIUS_KM
    
    # If location enforcement is disabled, skip boundary checks
    if not LOCATION_ENFORCEMENT_ENABLED:
        in_bounds = True
    
    print(f"DEBUG HEARTBEAT: {user.user_id} | Loc: ({user_lat:.6f}, {user_lon:.6f}) | Target: ({TARGET_LAT:.6f}, {TARGET_LON:.6f}) | Dist: {dist_km*1000:.2f}m | Limit: {ALLOWED_RADIUS_KM*1000:.0f}m | InBounds: {in_bounds} | Enforcement: {LOCATION_ENFORCEMENT_ENABLED}")

    now_utc = datetime.now(pytz.utc)
    local_tz = pytz.timezone('Asia/Kolkata')
    now_local = now_utc.astimezone(local_tz)
    today_str = now_local.strftime('%Y-%m-%d')
    flags = get_time_policy_flags(now_local)

    alert_message = None
    alert_code = None
    marked_absent = False

    # 12:50 PM pre-alert for lunch start policy reminder.
    if flags["is_lunch_pre_alert"]:
        alert_message = "Lunch window starts at 01:00 PM and ends at 01:40 PM. Return before 01:40 PM."
        alert_code = "LUNCH_START_REMINDER"

    # 10-minute reminder before lunch close (01:30 PM to 01:40 PM).
    if flags["is_return_pre_alert"]:
        alert_message = "10-minute reminder: Lunch free-exit ends at 01:40 PM. Please return inside campus now."
        alert_code = "LUNCH_END_REMINDER"

    # Lunch free-exit window: outside campus is allowed until 01:40 PM.
    if flags["is_lunch_window"] and not in_bounds:
        in_bounds = True
        print(f"DEBUG HEARTBEAT: {user.user_id} allowed outside campus during lunch window.")

    # After 1:40 PM, outside campus is marked absent until check-out window starts.
    if flags["is_post_lunch_enforcement"] and not in_bounds:
        today_log = AttendanceLog.query.filter_by(user_id=user.user_id, date=today_str).first()
        if today_log and not today_log.time_out:
            today_log.status = "Absent"
            db.session.commit()
            marked_absent = True
            alert_message = "Outside campus after 01:40 PM. Marked Absent. Contact admin if extra time is required."
            alert_code = "POST_LUNCH_OUT_OF_BOUNDS_ABSENT"
        elif not today_log:
            alert_message = "Outside campus after 01:40 PM. Check-in and stay within campus boundary."
            alert_code = "POST_LUNCH_OUT_OF_BOUNDS"

    if in_bounds:
        presence_code = 'OK'
        presence_msg = 'Inside campus boundary.'
    else:
        presence_code = 'OUT_OF_BOUNDS'
        presence_msg = f'Outside campus boundary ({round(dist_km * 1000, 2)} m from center).'

    upsert_live_presence(
        user,
        status_code=presence_code,
        status_message=presence_msg,
        source='heartbeat',
        latitude=user_lat,
        longitude=user_lon,
        distance_m=round(dist_km * 1000, 2),
        in_bounds=in_bounds
    )
    db.session.commit()

    return jsonify({
        "success": True,
        "server_time": now_local.strftime('%H:%M:%S'),
        "date": today_str,
        "distance_m": round(dist_km * 1000, 2),
        "in_bounds": in_bounds,
        "marked_absent": marked_absent,
        "time_flags": flags,
        "alert": alert_message,
        "alert_code": alert_code
    })


@app.route('/api/faculty/location', methods=['POST'])
def faculty_location():
    """
    REQUEST:
    {
        "user_id": "203CD",
        "latitude": 17.937823,
        "longitude": 79.848803,
        "accuracy": 15.5,
        "network_status": "online",
        "timestamp": "2026-04-16T15:30:45.123Z"
    }
    """
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({"success": False, "message": "user_id required"}), 400
        
        # Verify user exists and is faculty
        user = User.query.filter_by(user_id=user_id).first()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        if user.role != 'faculty':
            return jsonify({"success": False, "message": "Only faculty can submit location"}), 403
        
        # Verify user is session-active (logged in)
        # NOTE: Even after cache clear, as long as they're on the campus with network,
        # their location pings prove presence
        
        # Parse location data
        try:
            user_lat = float(data.get('latitude'))
            user_lon = float(data.get('longitude'))
            accuracy = float(data.get('accuracy', 0))
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "Invalid location data"}), 400
        
        # Calculate distance from target
        dist_km = haversine(user_lat, user_lon, TARGET_LAT, TARGET_LON)
        in_bounds = dist_km <= ALLOWED_RADIUS_KM if LOCATION_ENFORCEMENT_ENABLED else True
        
        # Get timestamp
        timestamp_str = data.get('timestamp')
        try:
            if timestamp_str:
                # Parse ISO format timestamp
                timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            else:
                timestamp = datetime.utcnow()
        except:
            timestamp = datetime.utcnow()
        
        # Get local date string
        local_tz = pytz.timezone('Asia/Kolkata')
        timestamp_local = timestamp.astimezone(local_tz) if timestamp.tzinfo else datetime.fromtimestamp(timestamp.timestamp(), tz=local_tz)
        date_str = timestamp_local.strftime('%Y-%m-%d')
        
        network_status = data.get('network_status', 'online')
        
        # CRITICAL: Store location log entry
        location_log = LocationLog(
            user_id=user_id,
            date=date_str,
            latitude=user_lat,
            longitude=user_lon,
            distance_m=round(dist_km * 1000, 2),
            in_bounds=in_bounds,
            network_status=network_status,
            accuracy_m=accuracy,
            timestamp=timestamp
        )
        db.session.add(location_log)
        
        # Update LivePresence for real-time display
        status_code = 'OK' if in_bounds else 'OUT_OF_BOUNDS'
        status_message = 'In campus' if in_bounds else f'Outside boundary ({round(dist_km * 1000, 2)}m away)'
        
        upsert_live_presence(
            user,
            status_code=status_code,
            status_message=status_message,
            source='location_ping',
            latitude=user_lat,
            longitude=user_lon,
            distance_m=round(dist_km * 1000, 2),
            in_bounds=in_bounds
        )
        
        db.session.commit()
        
        print(f"[LocationPing] {user_id} | Loc: ({user_lat:.6f}, {user_lon:.6f}) | Dist: {dist_km*1000:.0f}m | Bounds: {in_bounds} | Network: {network_status} | Time: {timestamp_local.strftime('%H:%M:%S')}")
        
        return jsonify({
            "success": True,
            "message": "Location received",
            "in_bounds": in_bounds,
            "distance_m": round(dist_km * 1000, 2),
            "server_time": datetime.now(local_tz).isoformat()
        }), 200
        
    except Exception as e:
        print(f"[LocationPing ERROR] {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/admin/live_locations', methods=['GET'])
def admin_live_locations():
    admin_id = request.args.get('admin_id')
    if not admin_id:
        return jsonify({"success": False, "message": "admin_id is required"}), 400

    admin = User.query.filter_by(user_id=admin_id).first()
    if not admin or admin.role != 'admin':
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    now_utc = datetime.utcnow()
    stale_cutoff = now_utc - timedelta(seconds=25)

    presences = LivePresence.query.filter(
        LivePresence.role.in_(['faculty', 'admin']),
        LivePresence.user_id != 'ADMIN01'
    ).all()
    map_points = []
    fault_alerts = []

    # Get current time for policy calculation
    now_utc = datetime.utcnow()
    local_tz = pytz.timezone('Asia/Kolkata')
    now_local = now_utc.astimezone(local_tz)
    flags = get_time_policy_flags(now_local)

    for p in presences:
        effective_code = p.status_code or 'UNKNOWN'
        effective_message = p.status_message or 'Status unavailable.'

        if not p.last_seen or p.last_seen < stale_cutoff:
            effective_code = 'NETWORK_OFF'
            effective_message = 'No recent heartbeat from device. Network may be OFF.'

        # Calculate policy status based on time windows
        # ALLOWED: In bounds physically OR in lunch window free-exit (13:00-13:40)
        # BLOCKED: Out of bounds AND (not in lunch window OR enforcement disabled)
        policy_in_bounds = p.in_bounds  # Default: physical status
        
        if not p.in_bounds:
            # If outside bounds, check if lunch window exemption applies
            if flags["is_lunch_window"]:
                policy_in_bounds = True  # ALLOWED during lunch free-exit
            # After lunch enforcement period and not checked out: BLOCKED
            elif flags["is_post_lunch_enforcement"]:
                policy_in_bounds = False  # BLOCKED after lunch end
        
        # Include ALL users in map_points (including out-of-bounds)
        if p.latitude is not None and p.longitude is not None:
            map_points.append({
                "user_id": p.user_id,
                "name": p.name,
                "role": p.role,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "distance_m": p.distance_m,
                "last_seen": p.last_seen.isoformat() + 'Z' if p.last_seen else None,
                "status": "OK" if (p.status_code == 'OK' or p.status_code is None) and p.in_bounds else "OUT_OF_BOUNDS" if not p.in_bounds else p.status_code,
                "in_bounds": p.in_bounds,
                "policy_in_bounds": policy_in_bounds,  # NEW: Policy status based on time windows
                "device_status": {
                    "network_on": p.last_seen and p.last_seen >= stale_cutoff,
                    "location_on": p.latitude is not None and p.longitude is not None
                }
            })

        # Always include any non-OK status as a fault alert (network off, location off, out of bounds, etc)
        if effective_code != 'OK':
            fault_alerts.append({
                "fault_key": f"{p.user_id}:{effective_code}",
                "user_id": p.user_id,
                "name": p.name,
                "role": p.role,
                "code": effective_code,
                "message": effective_message,
                "last_seen": p.last_seen.isoformat() + 'Z' if p.last_seen else None
            })
            print(f"DEBUG: Fault Alert Added: {p.user_id} | {effective_code} | {effective_message}")

    recent_security_alerts = SecurityAlert.query.filter(
        SecurityAlert.created_at >= (now_utc - timedelta(minutes=30)),
        SecurityAlert.user_id != 'ADMIN01'
    ).order_by(SecurityAlert.created_at.desc()).limit(100).all()

    event_alerts = [
        {
            "fault_key": f"EVENT:{a.id}",
            "user_id": a.user_id,
            "name": a.user_name,
            "role": a.role,
            "code": a.event_code,
            "message": a.event_message,
            "created_at": a.created_at.isoformat() + 'Z' if a.created_at else None
        }
        for a in recent_security_alerts
    ]

    # NEW: Get inactive users (logged out / not in LivePresence)
    all_users = User.query.filter(
        User.role.in_(['faculty', 'admin']),
        User.user_id != 'ADMIN01'
    ).all()
    
    active_user_ids = {p.user_id for p in presences}
    inactive_users = []
    
    for user in all_users:
        if user.user_id not in active_user_ids:
            # Get last activity timestamp for inactive user from AttendanceLog
            last_log = AttendanceLog.query.filter_by(user_id=user.user_id).order_by(AttendanceLog.timestamp_out.desc(), AttendanceLog.timestamp_in.desc()).first()
            last_activity = None
            if last_log:
                # Use check-out time if available, else check-in time
                last_activity = (last_log.timestamp_out or last_log.timestamp_in).isoformat() + 'Z' if (last_log.timestamp_out or last_log.timestamp_in) else None
            
            inactive_users.append({
                "user_id": user.user_id,
                "name": user.name,
                "role": user.role,
                "latitude": None,
                "longitude": None,
                "distance_m": None,
                "last_seen": last_activity,  # NEW: Get from AttendanceLog
                "status": "OFFLINE",
                "in_bounds": False,
                "policy_in_bounds": False,
                "device_status": {
                    "network_on": False,
                    "location_on": False
                }
            })

    return jsonify({
        "success": True,
        "target": {
            "latitude": TARGET_LAT,
            "longitude": TARGET_LON,
            "radius_m": round(ALLOWED_RADIUS_KM * 1000, 2)
        },
        "map_points": map_points,
        "inactive_users": inactive_users,  # NEW: Include users who are not currently tracking
        "fault_alerts": fault_alerts,
        "event_alerts": event_alerts,
        "server_time": now_utc.isoformat() + 'Z'
    })


@app.route('/api/admin/permissions', methods=['POST'])
def admin_create_permission():
    """Admin creates permission record after offline faculty request."""
    try:
        data = request.json or {}
        admin_id = (data.get('admin_id') or '').strip()
        admin_user = require_active_admin(admin_id)
        if not admin_user:
            return jsonify({"success": False, "message": "Unauthorized. Active admin required."}), 403

        user_id = (data.get('user_id') or '').strip()
        perm_type = (data.get('type') or '').strip().upper()
        date_str = (data.get('date') or datetime.now().strftime('%Y-%m-%d')).strip()
        start_time = normalize_time_hhmm(data.get('start_time'))
        end_time = normalize_time_hhmm(data.get('end_time'))
        is_full_day = bool(data.get('is_full_day', False))
        custom_days = normalize_custom_days(data.get('custom_days'))
        reason = (data.get('reason') or '').strip()
        status = (data.get('status') or 'Pending').strip().title()

        if not user_id or perm_type not in {'LP', 'EP'}:
            return jsonify({"success": False, "message": "Valid user_id and type (LP/EP) are required."}), 400
        if status not in {'Pending', 'Approved', 'Rejected'}:
            return jsonify({"success": False, "message": "status must be Pending, Approved, or Rejected."}), 400

        try:
            datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({"success": False, "message": "date must be in YYYY-MM-DD format."}), 400

        if not is_full_day:
            if not start_time or not end_time:
                return jsonify({"success": False, "message": "start_time and end_time are required unless full-day permission is selected."}), 400
            start_obj = datetime.strptime(start_time, '%H:%M')
            end_obj = datetime.strptime(end_time, '%H:%M')
            if end_obj <= start_obj:
                return jsonify({"success": False, "message": "end_time must be later than start_time."}), 400
        else:
            start_time = None
            end_time = None

        faculty = User.query.filter_by(user_id=user_id).first()
        if not faculty or faculty.role not in ['faculty', 'student', 'admin']:
            return jsonify({"success": False, "message": "Target user not found."}), 404

        permission = PermissionRequest(
            user_id=user_id,
            type=perm_type,
            date=date_str,
            start_time=start_time,
            end_time=end_time,
            is_full_day=is_full_day,
            custom_days=custom_days,
            reason=reason,
            status=status
        )
        db.session.add(permission)

        db.session.add(AdminAuditLog(
            action='permission_created',
            admin_id=admin_id,
            target_id=user_id,
            description=f"Permission {perm_type} created for {user_id} on {date_str} ({'Full Day' if is_full_day else f'{start_time}-{end_time}'}) with status {status}."
        ))
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Permission request recorded by admin.",
            "permission": {
                "id": permission.id,
                "user_id": permission.user_id,
                "type": permission.type,
                "date": permission.date,
                "start_time": permission.start_time,
                "end_time": permission.end_time,
                "is_full_day": bool(permission.is_full_day),
                "custom_days": permission.custom_days,
                "reason": permission.reason,
                "status": permission.status
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/admin/permissions', methods=['GET'])
def admin_list_permissions():
    """Admin views permission requests and decisions."""
    try:
        admin_id = (request.args.get('admin_id') or '').strip()
        admin_user = require_active_admin(admin_id)
        if not admin_user:
            return jsonify({"success": False, "message": "Unauthorized. Active admin required."}), 403

        status_filter = (request.args.get('status') or '').strip().title()
        user_filter = (request.args.get('user_id') or '').strip()
        date_filter = (request.args.get('date') or '').strip()

        query = PermissionRequest.query
        if status_filter in {'Pending', 'Approved', 'Rejected'}:
            query = query.filter(PermissionRequest.status == status_filter)
        if user_filter:
            query = query.filter(PermissionRequest.user_id == user_filter)
        if date_filter:
            query = query.filter(PermissionRequest.date == date_filter)

        permissions = query.order_by(PermissionRequest.id.desc()).all()
        user_ids = list({p.user_id for p in permissions})
        users = User.query.filter(User.user_id.in_(user_ids)).all() if user_ids else []
        user_map = {u.user_id: u for u in users}

        return jsonify({
            "success": True,
            "permissions": [
                {
                    "id": p.id,
                    "user_id": p.user_id,
                    "name": user_map[p.user_id].name if p.user_id in user_map else p.user_id,
                    "role": user_map[p.user_id].role if p.user_id in user_map else '-',
                    "type": p.type,
                    "date": p.date,
                    "start_time": p.start_time,
                    "end_time": p.end_time,
                    "is_full_day": bool(p.is_full_day),
                    "custom_days": p.custom_days,
                    "reason": p.reason,
                    "status": p.status
                }
                for p in permissions
            ]
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/admin/permissions/<int:permission_id>/decision', methods=['POST'])
def admin_decide_permission(permission_id):
    """Admin approves/rejects permission after in-person faculty request."""
    try:
        data = request.json or {}
        admin_id = (data.get('admin_id') or '').strip()
        admin_user = require_active_admin(admin_id)
        if not admin_user:
            return jsonify({"success": False, "message": "Unauthorized. Active admin required."}), 403

        decision = (data.get('decision') or '').strip().title()
        decision_reason = (data.get('decision_reason') or '').strip()
        if decision not in {'Approved', 'Rejected'}:
            return jsonify({"success": False, "message": "decision must be Approved or Rejected."}), 400

        permission = PermissionRequest.query.get(permission_id)
        if not permission:
            return jsonify({"success": False, "message": "Permission request not found."}), 404

        permission.status = decision
        if decision_reason:
            existing_reason = permission.reason or ''
            permission.reason = (existing_reason + f" | Admin note: {decision_reason}").strip(' |')

        db.session.add(AdminAuditLog(
            action='permission_decision',
            admin_id=admin_id,
            target_id=permission.user_id,
            description=f"Permission #{permission.id} ({permission.type}) marked {decision}."
        ))
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Permission request {decision.lower()}.",
            "permission": {
                "id": permission.id,
                "user_id": permission.user_id,
                "type": permission.type,
                "date": permission.date,
                "start_time": permission.start_time,
                "end_time": permission.end_time,
                "is_full_day": bool(permission.is_full_day),
                "custom_days": permission.custom_days,
                "reason": permission.reason,
                "status": permission.status
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

# 4B. Delete Permission Request (Admin Only)
@app.route('/api/admin/permissions/<int:permission_id>', methods=['DELETE'])
def delete_permission(permission_id):
    """Admin deletes a permission request (pending or decided)."""
    try:
        data = request.json or {}
        admin_id = (data.get('admin_id') or '').strip()
        admin_user = require_active_admin(admin_id)
        if not admin_user:
            return jsonify({"success": False, "message": "Unauthorized. Active admin required."}), 403

        permission = PermissionRequest.query.get(permission_id)
        if not permission:
            return jsonify({"success": False, "message": "Permission request not found."}), 404

        perm_type = permission.type
        perm_user_id = permission.user_id
        
        db.session.add(AdminAuditLog(
            action='permission_deleted',
            admin_id=admin_id,
            target_id=permission.user_id,
            description=f"Permission #{permission.id} ({permission.type}) on {permission.date} deleted."
        ))
        
        db.session.delete(permission)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Permission request deleted successfully."
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

# 5. Manual Attendance (Admin Only)
@app.route('/api/mark_attendance', methods=['POST'])
def mark_attendance():
    data = request.json or {}
    user_id = data.get('user_id')
    admin_id = (data.get('admin_id') or '').strip()

    admin_user = require_active_admin(admin_id)
    if not admin_user:
        return jsonify({"success": False, "message": "Unauthorized. Active admin required."}), 403

    user = User.query.filter_by(user_id=user_id).first()
    
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
        
    # Use UTC -> Local
    now_utc = datetime.now(pytz.utc)
    local_tz = pytz.timezone('Asia/Kolkata')
    now_local = now_utc.astimezone(local_tz)

    today_str = now_local.strftime('%Y-%m-%d')
    time_str = now_local.strftime('%H:%M:%S')
    
    # Check if already checked in today
    today_log = AttendanceLog.query.filter_by(user_id=user_id, date=today_str).first()
    
    msg = ""
    log_type = "IN"
    
    if today_log:
        if today_log.time_out:
            return jsonify({"success": False, "message": "User already completed attendance for today"}), 400
        else:
             # Check out using configured second-mark rules
             second = classify_second_mark(today_log.check_in_status or today_log.status, now_local)
             if not second["allowed"]:
                 return jsonify({"success": False, "message": second["message"]}), 400

             log_type = 'OUT'
             today_log.time_out = time_str
             today_log.timestamp_out = now_utc
             today_log.check_out_status = second["out_status"]
             today_log.check_out_period = second["period"]
             today_log.status = second["final_status"]
             msg = second["message"]
             db.session.commit()
    else:
        # Check in using configured first-mark rules
        first = classify_first_mark(now_local)
        if not first["allowed"]:
            return jsonify({"success": False, "message": first["message"]}), 400

        new_log = AttendanceLog(
            user_id=user_id,
            date=today_str,
            time_in=time_str,
            time_out=None,
            check_in_status=first["status"],
            check_in_period=first["period"],
            timestamp_in=now_utc,
            status=first["status"]
        )
        db.session.add(new_log)
        db.session.commit()
        msg = first["message"]

    # Audit Log
    audit = AuditLog(
        admin_id=admin_id,
        action=f"Marked {log_type} for {user.name} ({user_id})",
        timestamp=now_utc,
        reason="Manual Entry"
    )
    db.session.add(audit)
    
    return jsonify({
        "success": True, 
        "message": msg,
        "entry": {
            "type": log_type,
            "time": time_str,
            "status": "Updated"
        }
    })

# 6. Get Dashboard Data
@app.route('/api/dashboard/<role>/<user_id>', methods=['GET'])
def get_dashboard(role, user_id):
    # Use UTC to filter for "Today" requires conversion
    now_utc = datetime.now(pytz.utc)
    local_tz = pytz.timezone('Asia/Kolkata') # Configurable
    now_local = now_utc.astimezone(local_tz)
    today_str = now_local.strftime('%Y-%m-%d')
    
    if role == 'admin':
        # Admin sees everything
        # EXCLUDE ADMIN01 from stats
        total = User.query.filter(User.user_id != 'ADMIN01').count()
        
        # Filter logs to exclude ADMIN01 actions if they exist
        logs_today = AttendanceLog.query.filter(AttendanceLog.date == today_str, AttendanceLog.user_id != 'ADMIN01').all()
        
        # Unique users present today
        present_user_ids = set([l.user_id for l in logs_today if not is_absence_status(l.status)])
        present_count = len(present_user_ids)
        
        # Calculate Absent
        absent_count = total - present_count
        
        # Calculate Late Arrivals
        late_logs = [l for l in logs_today if l.status and ('Late' in l.status)]
        late_count = len(set([l.user_id for l in late_logs]))
        
        # Recent logs (Exclude ADMIN01)
        recent_logs = AttendanceLog.query.filter(AttendanceLog.user_id != 'ADMIN01').order_by(AttendanceLog.timestamp_in.desc()).limit(10).all()
        logs_data = []
        for log in recent_logs:
            u = User.query.filter_by(user_id=log.user_id).first()
            if u and u.user_id == 'ADMIN01': continue # Double safety check
            
            logs_data.append({
                "id": log.user_id,
                "name": u.name if u else "Unknown",
                "role": u.role if u else "-",
                "date": log.date,
                "time_in": log.time_in,
                "time_out": log.time_out if log.time_out else "-", 
                "status": log.status
            })
            
        return jsonify({
            "stats": {
                "total_users": total,
                "present_today": present_count,
                "late_count": late_count,
                "absent_count": absent_count
            },
            "logs": logs_data
        })
        
    elif role == 'faculty' or role == 'student':
        # See only own logs
        # Order by Date descending
        logs = AttendanceLog.query.filter_by(user_id=user_id).order_by(AttendanceLog.id.desc()).all()
        logs_data = []
        for l in logs:
            duration_str = "-"
            if l.timestamp_in and l.timestamp_out:
                diff = l.timestamp_out - l.timestamp_in
                total_seconds = int(diff.total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                duration_str = f"{hours}h {minutes}m"
            
            logs_data.append({
                "date": l.date,
                "time_in": l.time_in,
                "time_out": l.time_out if l.time_out else "-",
                "duration": duration_str,
                "status": l.status
            })

        # Today's Check
        today_log = AttendanceLog.query.filter_by(user_id=user_id, date=today_str).first()
        
        last_in = "--:--"
        last_out = "--:--"
        current_status = "Not Marked"
        
        if today_log:
            last_in = today_log.time_in if today_log.time_in else "--:--"
            last_out = today_log.time_out if today_log.time_out else "--:--"
            
            if today_log.time_out:
                current_status = f"Checked Out ({today_log.status})" if today_log.status else "Checked Out"
            else:
                current_status = today_log.status if today_log.status else "Checked In"
        
        return jsonify({
            "logs": logs_data,
            "current_status": current_status,
            "last_check_in": last_in,
            "last_check_out": last_out
        })

    return jsonify({"error": "Invalid Role"}), 400

# 7. Bulk Import Users
@app.route('/api/bulk_import', methods=['POST'])
def bulk_import():
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "message": "No file part"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "message": "No selected file"}), 400
            
        if file:
            df = pd.read_csv(file)
            # Expected columns: user_id, name, role, password (optional)
            
            count = 0
            errors = []
            
            for index, row in df.iterrows():
                try:
                    uid = str(row['user_id'])
                    # Block importing as ADMIN01
                    if uid == 'ADMIN01':
                         continue

                    if User.query.filter_by(user_id=uid).first():
                        errors.append(f"User {uid} already exists")
                        continue
                        
                    raw_pw = row.get('password', uid)
                    pw_hash = bcrypt.hashpw(str(raw_pw).encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                    
                    new_user = User(
                        user_id=uid,
                        name=row['name'],
                        role=row['role'],
                        password_hash=pw_hash,
                        face_encoding=None # Import text data only, face needs registration later
                    )
                    db.session.add(new_user)
                    count += 1
                except Exception as row_err:
                    errors.append(f"Row {index}: {str(row_err)}")
            
            db.session.commit()
            
            return jsonify({
                "success": True, 
                "message": f"Imported {count} users.",
                "errors": errors
            })
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# 7. Reports - Analytics Data
@app.route('/api/report', methods=['GET'])
def get_analytics_data():
    try:
        # 1. Get Filters
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        # Default to last 30 days if not provided
        if not start_date_str or not end_date_str:
            today = datetime.now()
            start_date = today - pd.Timedelta(days=30)
            start_date_str = start_date.strftime('%Y-%m-%d')
            end_date_str = today.strftime('%Y-%m-%d')
            
        # 2. Get Total Users (Excluding Admin) for "Absent" calculation
        relevant_users = User.query.filter(User.user_id != 'ADMIN01').all()
        total_staff_count = len(relevant_users)
        
        # 3. Fetch Logs in Range
        logs = AttendanceLog.query.filter(
            AttendanceLog.date >= start_date_str,
            AttendanceLog.date <= end_date_str,
            AttendanceLog.user_id != 'ADMIN01'
        ).all()
        
        # 4. Aggregate Data by Date
        daily_map = {}
        
        # Initialize map for fill gaps
        try:
            s_date = datetime.strptime(start_date_str, "%Y-%m-%d")
            e_date = datetime.strptime(end_date_str, "%Y-%m-%d")
            delta = e_date - s_date
            
            for i in range(delta.days + 1):
                day = s_date + pd.Timedelta(days=i)
                day_str = day.strftime('%Y-%m-%d')
                daily_map[day_str] = {
                    "date": day_str,
                    "present": 0,
                    "absent": total_staff_count, # Default all absent
                    "late": 0,
                    "check_ins": []
                }
        except Exception as date_err:
            print(f"Date Parsing Error: {date_err}")
            
        # Fill with log data
        for log in logs:
            if log.date in daily_map:
                entry = daily_map[log.date]
                if not is_absence_status(log.status):
                    entry["present"] += 1
                    entry["absent"] = max(0, entry["absent"] - 1)
                    
                    if log.status and "Late" in log.status:
                        entry["late"] += 1
                         
                    if log.time_in:
                        try:
                            t = datetime.strptime(log.time_in, "%H:%M:%S")
                            seconds = t.hour * 3600 + t.minute * 60 + t.second
                            entry["check_ins"].append(seconds)
                        except:
                           pass

        # 5. Finalize Daily Stats List
        daily_stats = []
        for date_key in sorted(daily_map.keys()):
            d = daily_map[date_key]
            
            # Calc Average Time
            avg_time_str = "-"
            if d["check_ins"]:
                avg_sec = sum(d["check_ins"]) / len(d["check_ins"])
                m, s = divmod(avg_sec, 60)
                h, m = divmod(m, 60)
                avg_time_str = "{:02d}:{:02d}".format(int(h), int(m))
            
            daily_stats.append({
                "date": d["date"],
                "present": d["present"],
                "absent": d["absent"],
                "late": d["late"],
                "avg_check_in": avg_time_str
            })

        # 6. Department Breakdown
        dept_counts = {} 
        user_role_map = {u.user_id: u.role for u in relevant_users}
        user_name_map = {u.user_id: u.name for u in relevant_users}
        
        for log in logs:
            role = user_role_map.get(log.user_id, "Unknown")
            dept_counts[role] = dept_counts.get(role, 0) + 1
            
        dept_stats = [{"label": k, "value": v} for k, v in dept_counts.items()]
        
        # 7. Late Arrival Leaderboard (Top 5)
        late_counts = {}
        for log in logs:
            if log.status and "Late" in log.status:
                late_counts[log.user_id] = late_counts.get(log.user_id, 0) + 1
        
        sorted_late = sorted(late_counts.items(), key=lambda item: item[1], reverse=True)[:5]
        leaderboard = [{"name": user_name_map.get(uid, uid), "count": count} for uid, count in sorted_late]

        # 8. Check-in Time Distribution
        # Define buckets based on system logic (9:30 Start)
        distribution = {
            "Early (Before 9:00)": 0,
            "On Time (9:00 - 9:30)": 0,
            "Early Permission (9:30 - 9:45)": 0,
            "Late (After 9:45)": 0
        }
        
        for log in logs:
            if not log.time_in: continue
            try:
                t = datetime.strptime(log.time_in, "%H:%M:%S").time()
                # Compare
                if t < time(9, 0):
                    distribution["Early (Before 9:00)"] += 1
                elif t < time(9, 30):
                    distribution["On Time (9:00 - 9:30)"] += 1
                elif t <= time(9, 45):
                    distribution["Early Permission (9:30 - 9:45)"] += 1
                else:
                    distribution["Late (After 9:45)"] += 1
            except:
                pass

        # 9. Recent Check-ins (Limit 5)
        # We need to re-query for sorted logs or sort the current list
        # detailed logs are already in 'logs', but not sorted by time necessarily (db default?)
        # Let's sort manually
        sorted_logs = sorted(logs, key=lambda x: (x.date, x.time_in if x.time_in else ""), reverse=True)[:5]
        recent_activity = []
        for log in sorted_logs:
            recent_activity.append({
                "name": user_name_map.get(log.user_id, log.user_id),
                "time": f"{log.date} {log.time_in}" if log.time_in else f"{log.date} (No Time)",
                "status": log.status
            })

        return jsonify({
            "daily_stats": daily_stats,
            "department_stats": dept_stats,
            "leaderboard": leaderboard,
            "time_distribution": distribution, 
            "recent_activity": recent_activity,
            "summary": {
                "total_days": len(daily_stats),
                "total_present_events": sum(d['present'] for d in daily_stats),
                "total_faculty": total_staff_count
            }
        })

    except Exception as e:
        print(f"Analytics Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/download_report', methods=['GET'])
def download_excel():
    user_id = request.args.get('user_id')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    report_type = request.args.get('type', 'detailed') # 'detailed' or 'summary'

    if not start_date_str or not end_date_str:
        return jsonify({"error": "Start and End dates are required."}), 400

    try:
        # Fetch logs
        query = AttendanceLog.query.filter(
            AttendanceLog.date >= start_date_str, 
            AttendanceLog.date <= end_date_str,
            AttendanceLog.user_id != 'ADMIN01' # EXCLUDE ADMIN
        )
        if user_id:
             query = query.filter_by(user_id=user_id)
        
        # Sort by Date descending (newest first)
        logs = query.order_by(AttendanceLog.date.desc(), AttendanceLog.time_in.desc()).all()
        
        if report_type == 'detailed':
            # --- 1. DETAILED MONTHLY REPORT ---
            # Columns: Staff ID, Name, Position, Date, Check In, Check Out, Check In Status, Check Out Status
            
            report_data = []
            for log in logs:
                u = User.query.filter_by(user_id=log.user_id).first()
                status_in = log.check_in_status if hasattr(log, 'check_in_status') and log.check_in_status else (log.status if log.time_in else "-")
                status_out = log.check_out_status if hasattr(log, 'check_out_status') and log.check_out_status else (log.status if log.time_out else "-")
                
                report_data.append({
                    "Staff ID": log.user_id,
                    "Name": u.name if u else "Unknown",
                    "Position": u.role if u else "-",
                    "Date": log.date,
                    "Check In": log.time_in if log.time_in else "-",
                    "Check Out": log.time_out if log.time_out else "-",
                    "Check In Status": status_in,
                    "Check Out Status": status_out
                })

            df = pd.DataFrame(report_data)
            filename = f"attendance_report_{start_date_str[:7]}.csv" # YYYY-MM
            
        elif report_type == 'summary':
            # --- 2. MONTHLY SUMMARY REPORT ---
            # Aggr per user.
            # Columns: Staff ID, Name, Position, Days Present, Working Days, Attendance %, Status
            
            # Get all users (filtered if user_id provided)
            if user_id:
                users_list = [User.query.filter_by(user_id=user_id).first()]
            else:
                users_list = User.query.filter(User.user_id != 'ADMIN01').all() # EXCLUDE ADMIN
                
            report_data = []
            
            # Calculate Working Days in Range
            # "Total weekdays - Holidays"
            # 1. Parse dates
            start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date_str, "%Y-%m-%d")
            
            # 2. Count weekdays
            total_days = (end_dt - start_dt).days + 1
            weekdays_count = 0
            for i in range(total_days):
                day = start_dt + pd.Timedelta(days=i)
                if day.weekday() < 5: # 0-4 is Mon-Fri
                    weekdays_count += 1
            
            # 3. Subtract Holidays
            holidays_count = Holiday.query.filter(Holiday.date >= start_date_str, Holiday.date <= end_date_str).count()
            working_days = max(1, weekdays_count - holidays_count) # Avoid division by zero
            
            for u in users_list:
                if not u: continue
                # Count days present for this user in this range
                days_present = AttendanceLog.query.filter(
                    AttendanceLog.user_id == u.user_id,
                    AttendanceLog.date >= start_date_str,
                    AttendanceLog.date <= end_date_str,
                    AttendanceLog.time_in != None # Must have at least check in
                ).count()
                
                raw_pct = (days_present / working_days) * 100
                attendance_pct = round(raw_pct, 1)
                
                # Categorize
                perf_status = "Poor"
                if attendance_pct >= 80:
                    perf_status = "Excellent"
                elif attendance_pct >= 50:
                    perf_status = "Good"

                report_data.append({
                    "Staff ID": u.user_id,
                    "Name": u.name,
                    "Position": u.role,
                    "Days Present": days_present,
                    "Working Days": working_days,
                    "Attendance %": f"{attendance_pct}%",
                    "Status": perf_status
                })
                
            df = pd.DataFrame(report_data)
            filename = f"attendance_summary_{start_date_str[:7]}.csv" # YYYY-MM

        else:
            return jsonify({"error": "Invalid report type"}), 400

        # Export CSV
        output = io.BytesIO()
        df.to_csv(output, index=False)
        output.seek(0)

        response = make_response(send_file(
            output,
            mimetype="text/csv",
            as_attachment=True,
            download_name=filename
        ))
        # Mobile-compatibility: expose Content-Disposition so JS can read filename
        response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'
        response.headers['Cache-Control'] = 'no-store'
        return response

    except Exception as e:
        print("Report Gen Error:", e)
        return jsonify({"error": str(e)}), 500


def filter_report_columns(report_data, report_type, selected_columns):
    """
    Filter report data to include only selected columns based on user preferences.
    
    Args:
        report_data: List of dictionaries containing report
        report_type: Type of report (summary, detailed, violations, compliance)
        selected_columns: Dict with keys {user, date, status, location, checkin, period}
    
    Returns:
        Filtered list of dictionaries with only selected columns
    """
    if not report_data or not selected_columns:
        return report_data
    
    # Define column mappings for each report type
    column_map = {
        'summary': {
            'user': ['Staff ID', 'Name', 'Role'],
            'date': [],
            'status': ['Present Days', 'Absent Days', 'Late Days', 'Attendance %'],
            'location': [],
            'checkin': [],
            'period': ['Attendance %']
        },
        'detailed': {
            'user': ['Staff ID', 'Name', 'Role'],
            'date': ['Date'],
            'status': ['Day Status', 'Check-in Status', 'Check-out Status'],
            'location': [],
            'checkin': ['Check-in', 'Check-out'],
            'period': ['Period']
        },
        'violations': {
            'user': ['Staff ID', 'Name'],
            'date': ['Date'],
            'status': ['Violation Type'],
            'location': [],
            'checkin': ['Check-in'],
            'period': ['Severity']
        },
        'compliance': {
            'user': ['Staff ID', 'Name', 'Role'],
            'date': [],
            'status': ['Compliance %', 'Status'],
            'location': [],
            'checkin': [],
            'period': ['Working Days', 'Present', 'Late', 'Absent']
        }
    }
    
    # Always include core identifying columns
    always_include = set()
    if report_type != 'violations':  # Violations only has Staff ID and Name
        always_include = {'Staff ID', 'Name', 'Role'} if report_type != 'violations' else {'Staff ID', 'Name'}
    
    # Build list of columns to keep
    cols_to_keep = always_include.copy()
    
    if report_type in column_map:
        for col_key, col_list in column_map[report_type].items():
            if selected_columns.get(col_key, False):
                cols_to_keep.update(col_list)
    
    # Filter each row to only include selected columns
    if report_data and isinstance(report_data[0], dict):
        filtered_data = []
        for row in report_data:
            # Only include columns that both exist in the row AND are in cols_to_keep
            filtered_row = {k: v for k, v in row.items() if k in cols_to_keep}
            filtered_data.append(filtered_row)
        return filtered_data
    
    return report_data


# Export Report API (Multiple Formats)
@app.route('/api/export_report', methods=['GET'])
def export_report():
    """
    Advanced export endpoint supporting CSV, Excel, PDF formats and various filters.
    """
    try:
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        report_type = request.args.get('type', 'summary')
        file_format = request.args.get('format', 'csv')
        filter_latest = request.args.get('filter_latest', 'true').lower() == 'true'
        filter_violations = request.args.get('filter_violations', 'false').lower() == 'true'
        include_timestamps = request.args.get('include_timestamps', 'true').lower() == 'true'
        
        # Parse column preferences from frontend
        columns_param = request.args.get('columns', '{}')
        try:
            selected_columns = json.loads(columns_param)
        except:
            selected_columns = {}
        
        if not start_date_str or not end_date_str:
            return jsonify({"error": "Start and End dates required"}), 400
        
        # Validate format
        if file_format not in ['csv', 'excel', 'pdf', 'json']:
            file_format = 'csv'
        
        # Parse dates safely
        try:
            start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date_str, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
        
        # Build base query
        base_query = AttendanceLog.query.filter(
            AttendanceLog.date >= start_date_str,
            AttendanceLog.date <= end_date_str,
            AttendanceLog.user_id != 'ADMIN01'
        )
        
        # Apply violations filter
        if filter_violations:
            base_query = base_query.filter(
                (AttendanceLog.time_in == None) | 
                (AttendanceLog.status.in_(['Late', 'Absent', 'Out-of-Bounds']))
            )
        
        # Fetch logs
        logs = base_query.order_by(AttendanceLog.date.desc(), AttendanceLog.timestamp_in.desc()).all()
        
        # Apply latest filter
        if filter_latest and logs:
            seen = {}
            unique_logs = []
            for log in logs:
                key = (log.user_id, log.date)
                if key not in seen:
                    seen[key] = True
                    unique_logs.append(log)
            logs = unique_logs
        
        # Generate report based on type
        if report_type == 'summary':
            report_data = generate_summary_report(logs, start_dt, end_dt, include_timestamps)
        elif report_type == 'detailed':
            report_data = generate_detailed_report(logs, include_timestamps)
        elif report_type == 'violations':
            report_data = generate_violations_report(logs, include_timestamps)
        elif report_type == 'compliance':
            report_data = generate_compliance_report(logs, start_dt, end_dt)
        else:
            return jsonify({"error": "Invalid report type"}), 400
        
        if not report_data:
            report_data = []
        
        # Apply column filtering based on user selection
        report_data = filter_report_columns(report_data, report_type, selected_columns)
        
        # JSON format - return as JSON preview
        if file_format == 'json':
            return jsonify({
                "status": "success",
                "report_type": report_type,
                "date_range": f"{start_date_str} to {end_date_str}",
                "record_count": len(report_data),
                "data": report_data[:10]  # Limit to 10 for preview
            })
        
        # CSV format
        if file_format == 'csv':
            try:
                df = pd.DataFrame(report_data) if report_data else pd.DataFrame()
                output = io.BytesIO()
                df.to_csv(output, index=False)
                output.seek(0)
                
                return send_file(
                    output,
                    mimetype="text/csv",
                    as_attachment=True,
                    download_name=f"FaceAttend_Report_{report_type}_{start_date_str}.csv"
                )
            except Exception as e:
                return jsonify({"error": f"CSV export failed: {str(e)}"}), 500
        
        # Excel format
        if file_format == 'excel':
            try:
                from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
                
                df = pd.DataFrame(report_data) if report_data else pd.DataFrame()
                output = io.BytesIO()
                with pd.ExcelWriter(output, engine='openpyxl') as writer:
                    df.to_excel(writer, index=False, sheet_name='Report')
                    
                    # Get the workbook and worksheet
                    workbook = writer.book
                    worksheet = writer.sheets['Report']
                    
                    # Header formatting
                    header_fill = PatternFill(start_color='1e293b', end_color='1e293b', fill_type='solid')
                    header_font = Font(bold=True, color='FFFFFF', size=11)
                    center_align = Alignment(horizontal='center', vertical='center')
                    border = Border(
                        left=Side(style='thin'),
                        right=Side(style='thin'),
                        top=Side(style='thin'),
                        bottom=Side(style='thin')
                    )
                    
                    # Format header row
                    for cell in worksheet[1]:
                        cell.fill = header_fill
                        cell.font = header_font
                        cell.alignment = center_align
                        cell.border = border
                    
                    # Alternate row colors and borders
                    light_fill = PatternFill(start_color='f8f9fa', end_color='f8f9fa', fill_type='solid')
                    for row_num, row in enumerate(worksheet.iter_rows(min_row=2, max_row=worksheet.max_row), start=2):
                        for cell in row:
                            cell.border = border
                            if row_num % 2 == 0:
                                cell.fill = light_fill
                            cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
                    
                    # Auto-adjust column widths
                    for column in worksheet.columns:
                        max_length = 0
                        column_letter = column[0].column_letter
                        for cell in column:
                            try:
                                if len(str(cell.value)) > max_length:
                                    max_length = len(str(cell.value))
                            except:
                                pass
                        adjusted_width = min(max_length + 2, 50)
                        worksheet.column_dimensions[column_letter].width = adjusted_width
                    
                output.seek(0)
                
                return send_file(
                    output,
                    mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    as_attachment=True,
                    download_name=f"FaceAttend_Report_{report_type}_{start_date_str}.xlsx"
                )
            except Exception as e:
                return jsonify({"error": f"Excel export failed: {str(e)}"}), 500
        
        # PDF format
        if file_format == 'pdf':
            try:
                from reportlab.lib.pagesizes import letter, landscape
                from reportlab.lib import colors
                from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
                from reportlab.platypus import Table, TableStyle, SimpleDocTemplate, Paragraph, Spacer, PageBreak
                from reportlab.lib.units import inch
                from reportlab.lib.enums import TA_CENTER, TA_LEFT
                
                df = pd.DataFrame(report_data) if report_data else pd.DataFrame()
                output = io.BytesIO()
                doc = SimpleDocTemplate(output, pagesize=landscape(letter), topMargin=0.5*inch, bottomMargin=0.5*inch)
                elements = []
                
                # Styles
                styles = getSampleStyleSheet()
                title_style = ParagraphStyle(
                    'CustomTitle',
                    parent=styles['Heading2'],
                    fontSize=16,
                    textColor=colors.HexColor('#0f172a'),
                    spaceAfter=6,
                    alignment=TA_LEFT,
                    fontName='Helvetica-Bold'
                )
                subtitle_style = ParagraphStyle(
                    'Subtitle',
                    parent=styles['Normal'],
                    fontSize=10,
                    textColor=colors.HexColor('#64748b'),
                    spaceAfter=12,
                    alignment=TA_LEFT
                )
                
                # Title and metadata
                title = Paragraph(f"FaceAttend - {report_type.title()} Report", title_style)
                elements.append(title)
                subtitle = Paragraph(f"Date Range: {start_date_str} to {end_date_str} | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", subtitle_style)
                elements.append(subtitle)
                elements.append(Spacer(1, 0.2 * inch))
                
                # Table
                if not df.empty:
                    # Convert all values to strings to avoid reportlab issues with numpy types
                    data = [df.columns.tolist()] + df.astype(str).values.tolist()
                    col_count = len(df.columns)
                    col_width = 7 * inch / col_count if col_count > 0 else 1 * inch
                    t = Table(data, colWidths=[col_width] * col_count)
                    
                    # Enhanced table styling with alternating rows
                    style_commands = [
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 9),
                        ('FONTSIZE', (0, 1), (-1, -1), 8),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                        ('TOPPADDING', (0, 0), (-1, 0), 10),
                        ('PADDING', (0, 1), (-1, -1), 6),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
                    ]
                    t.setStyle(TableStyle(style_commands))
                    elements.append(t)
                    
                    # Add summary line
                    elements.append(Spacer(1, 0.2 * inch))
                    summary = Paragraph(f"<i>Total Records: {len(df)} | Export generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</i>", styles['Normal'])
                    elements.append(summary)
                else:
                    elements.append(Paragraph("No data found for the selected date range and filters.", styles['Normal']))
                
                doc.build(elements)
                output.seek(0)
                
                return send_file(
                    output,
                    mimetype="application/pdf",
                    as_attachment=True,
                    download_name=f"FaceAttend_Report_{report_type}_{start_date_str}.pdf"
                )
            except Exception as e:
                return jsonify({"error": f"PDF export failed: {str(e)}"}), 500
        
        return jsonify({"error": "Invalid format"}), 400
        
    except Exception as e:
        print(f"Export Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Export failed: {str(e)}"}), 500


def generate_summary_report(logs, start_dt, end_dt, include_timestamps=True):
    """Generate summary-level attendance report"""
    users_data = {}
    
    for log in logs:
        user = User.query.filter_by(user_id=log.user_id).first()
        if not user:
            continue
            
        if log.user_id not in users_data:
            users_data[log.user_id] = {
                'user_id': log.user_id,
                'name': user.name,
                'role': user.role,
                'days_present': 0,
                'days_absent': 0,
                'days_late': 0,
                'total_records': 0
            }
        
        users_data[log.user_id]['total_records'] += 1
        
        # Safely check status
        status = log.status if log.status else 'Unknown'
        has_time_in = log.time_in is not None and str(log.time_in).strip() != ''
        
        if status == 'Absent' or not has_time_in:
            users_data[log.user_id]['days_absent'] += 1
        elif status == 'Late Permission':
            users_data[log.user_id]['days_late'] += 1
        else:
            users_data[log.user_id]['days_present'] += 1
    
    # Calculate working days
    total_days = (end_dt - start_dt).days + 1
    weekdays = [i for i in range(total_days) if (start_dt + pd.Timedelta(days=i)).weekday() < 5]
    weekdays_count = len(weekdays)
    
    holidays = Holiday.query.filter(
        Holiday.date >= start_dt.strftime('%Y-%m-%d'),
        Holiday.date <= end_dt.strftime('%Y-%m-%d')
    ).count()
    working_days = max(1, weekdays_count - holidays)
    
    # Build report
    report_data = []
    for uid, data in users_data.items():
        present = data['days_present']
        attendance_pct = round((present / working_days * 100), 1) if working_days > 0 else 0
        
        row = {
            'Staff ID': uid,
            'Name': data['name'],
            'Role': data['role'],
            'Present Days': present,
            'Absent Days': data['days_absent'],
            'Late Days': data['days_late'],
            'Attendance %': f"{attendance_pct}%"
        }
        report_data.append(row)
    
    return report_data


def generate_detailed_report(logs, include_timestamps=True):
    """Generate detailed attendance log report"""
    report_data = []
    for log in logs:
        user = User.query.filter_by(user_id=log.user_id).first()
        
        # Determine check-in status based on actual check-in
        if log.time_in:
            # User checked in - use check_in_status or fall back to check calendar-based status (P/LP/HD/EP)
            status_in = log.check_in_status if (hasattr(log, 'check_in_status') and log.check_in_status) else 'Present'
        else:
            # No check-in time recorded
            status_in = 'Absent'
        
        status_out = log.check_out_status if hasattr(log, 'check_out_status') and log.check_out_status else '-'
        
        row = {
            'Date': log.date,
            'Staff ID': log.user_id,
            'Name': user.name if user else 'Unknown',
            'Role': user.role if user else 'N/A',
            'Check-in': log.time_in if log.time_in else 'Absent',
            'Check-out': log.time_out or '-',
            'Check-in Status': status_in,
            'Check-out Status': status_out,
            'Day Status': log.status,
            'Period': f"{log.check_in_period or '-'} / {log.check_out_period or '-'}"
        }
        report_data.append(row)
    
    return report_data


def generate_violations_report(logs, include_timestamps=True):
    """Generate violations-only report (absences, lates, out-of-bounds)"""
    report_data = []
    for log in logs:
        # Skip non-violation day statuses
        if log.status in ['FD', 'Present', 'Late Permission', 'HD']:
            continue
        
        user = User.query.filter_by(user_id=log.user_id).first()
        violation_type = 'Absent' if not log.time_in else (log.status or 'Other')
        
        row = {
            'Date': log.date,
            'Staff ID': log.user_id,
            'Name': user.name if user else 'Unknown',
            'Violation Type': violation_type,
            'Check-in': log.time_in or '-',
            'Severity': 'High' if violation_type == 'Absent' else 'Medium'
        }
        if include_timestamps:
            row['Timestamp'] = log.created_at.strftime('%Y-%m-%d %H:%M:%S') if hasattr(log, 'created_at') else '-'
        report_data.append(row)
    
    return report_data


def generate_compliance_report(logs, start_dt, end_dt):
    """Generate compliance metrics report"""
    # Calculate working days
    total_days = (end_dt - start_dt).days + 1
    weekdays_count = sum(1 for i in range(total_days) 
                        if (start_dt + pd.Timedelta(days=i)).weekday() < 5)
    holidays = Holiday.query.filter(
        Holiday.date >= start_dt.strftime('%Y-%m-%d'),
        Holiday.date <= end_dt.strftime('%Y-%m-%d')
    ).count()
    working_days = max(1, weekdays_count - holidays)
    
    # Get all unique users
    all_users = User.query.filter(User.user_id != 'ADMIN01').all()
    
    report_data = []
    for user in all_users:
        # Count records for this user in date range
        user_logs = [l for l in logs if l.user_id == user.user_id]
        
        present_days = sum(1 for l in user_logs if l.status in ['FD', 'HD', 'Present', 'Late Permission', 'EP'])
        late_days = sum(1 for l in user_logs if (hasattr(l, 'check_in_status') and l.check_in_status == 'Late Permission'))
        absent_days = sum(1 for l in user_logs if l.status == 'Absent' or not l.time_in)
        
        compliance_pct = round((present_days / working_days * 100), 1) if working_days > 0 else 0
        compliance_status = 'Compliant' if compliance_pct >= 80 else ('Non-Compliant' if compliance_pct < 60 else 'At Risk')
        
        row = {
            'Staff ID': user.user_id,
            'Name': user.name,
            'Role': user.role,
            'Working Days': working_days,
            'Present': present_days,
            'Late': late_days,
            'Absent': absent_days,
            'Compliance %': f"{compliance_pct}%",
            'Status': compliance_status
        }
        report_data.append(row)
    
    return report_data

# 9. Get All Users (For Staff Directory)
@app.route('/api/users', methods=['GET'])
def get_users():
    # EXCLUDE ADMIN
    users = User.query.filter(User.user_id != 'ADMIN01').all()
    user_list = []
    today = datetime.now().strftime('%Y-%m-%d')
    
    for u in users:
        # Check today's status
        log = AttendanceLog.query.filter_by(user_id=u.user_id, date=today).first()
        status = log.status if log else "Absent" # Default to Absent if no log
        
        user_list.append({
            "id": u.user_id,
            "name": u.name,
            "role": u.role,
            "status": status
        })
    return jsonify(user_list)

# 9A. Get Single User Details
@app.route('/api/users/<user_id>', methods=['GET'])
def get_user_details(user_id):
    """Get details of a specific user"""
    try:
        user = User.query.filter_by(user_id=user_id).first()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        today = datetime.now().strftime('%Y-%m-%d')
        log = AttendanceLog.query.filter_by(user_id=user_id, date=today).first()
        status = log.status if log else "Absent"
        
        return jsonify({
            "success": True,
            "user": {
                "id": user.user_id,
                "name": user.name,
                "role": user.role,
                "status": status,
                "registration_date": user.registration_date.strftime('%Y-%m-%d') if user.registration_date else None
            }
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# 9B. Delete User
@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        user = User.query.filter_by(user_id=user_id).first()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        # Delete related logs first
        AttendanceLog.query.filter_by(user_id=user_id).delete()
        PermissionRequest.query.filter_by(user_id=user_id).delete()
        
        # Delete user
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({"success": True, "message": f"User {user_id} deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

# 10. Mark User as Absent / Didn't Mark
@app.route('/api/mark_absent', methods=['POST'])
def mark_absent():
    try:
        data = request.json or {}
        user_id = data.get('user_id')
        date = data.get('date') or datetime.now().strftime('%Y-%m-%d')
        admin_id = (data.get('admin_id') or '').strip()

        admin_user = require_active_admin(admin_id)
        if not admin_user:
            return jsonify({"success": False, "message": "Unauthorized. Active admin required."}), 403
        
        # Verify user exists
        user = User.query.filter_by(user_id=user_id).first()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        # Check if attendance log exists for the date
        today_log = AttendanceLog.query.filter_by(user_id=user_id, date=date).first()
        
        if today_log:
            # Update existing log
            today_log.status = "Didn't Mark"
            db.session.commit()
        else:
            # Create new log marked as didn't mark
            new_log = AttendanceLog(
                user_id=user_id,
                date=date,
                status="Didn't Mark"
            )
            db.session.add(new_log)
            db.session.commit()
        
        # Log admin action
        audit = AdminAuditLog(
            action='marked_absent',
            admin_id=admin_id,
            target_id=user_id,
            description=f"Marked {user.name} as 'Didn't Mark' for {date}"
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({"success": True, "message": f"{user.name} marked as 'Didn't Mark'"}), 200
    except Exception as e:
        print(f"Mark Absent Error: {e}")
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        # Ensure fresh DB if asked (User can manually delete file, this ensures creation)
        db.create_all()
        ensure_permission_request_schema()
        ensure_attendance_log_schema()
        
        # Check if default admin exists
        if not User.query.filter_by(user_id='ADMIN01').first():
            print("Creating Default Admin Account...")
            try: 
                 # Create Default Admin
                admin = User(
                    user_id="ADMIN01", 
                    name="System Administrators", 
                    role="admin", 
                    face_encoding=None, 
                    password_hash=bcrypt.hashpw("admin".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                )
                db.session.add(admin)
                db.session.commit()
                print(">>> Default Admin Created: User=ADMIN01, Pass=admin")
            except Exception as e:
                print(f"Error creating admin: {e}")

# --------- COMPREHENSIVE NOTIFICATION API ---------

@app.route('/api/user/notifications', methods=['GET'])
def get_user_notifications():
    """
    Get comprehensive notifications for a user
    Returns: Active alerts, warnings, and policy status
    """
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "message": "user_id required"}), 400
    
    user = User.query.filter_by(user_id=user_id).first()
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    
    notifications = []
    now_utc = datetime.utcnow()
    local_tz = pytz.timezone('Asia/Kolkata')
    now_local = now_utc.astimezone(local_tz)
    today_str = now_local.strftime('%Y-%m-%d')
    flags = get_time_policy_flags(now_local)
    
    # 1. Check Network Status (simulate from heartbeat)
    presence = LivePresence.query.filter_by(user_id=user_id).first()
    
    if presence and presence.status_code == 'NETWORK_OFF':
        notifications.append({
            'type': 'NETWORK_OFF',
            'level': 'CRITICAL',
            'title': '📡 Network Offline',
            'message': 'Mobile data or Wi-Fi is currently OFF. Turn on to continue tracking.',
            'timestamp': now_local.isoformat(),
            'dismissible': False
        })
    
    # 2. Check Location Status
    if presence and presence.status_code == 'LOCATION_OFF':
        notifications.append({
            'type': 'LOCATION_OFF',
            'level': 'CRITICAL',
            'title': '📍 Location Services Disabled',
            'message': 'GPS/Location permission is OFF. Enable GPS to continue attendance tracking.',
            'timestamp': now_local.isoformat(),
            'dismissible': False
        })
    
    # 3. Check Out of Bounds Status
    if presence and presence.status_code == 'OUT_OF_BOUNDS' and not flags['is_lunch_window']:
        distance_str = f"{presence.distance_m:.0f}m" if presence.distance_m else "unknown"
        notifications.append({
            'type': 'OUT_OF_BOUNDS',
            'level': 'WARNING',
            'title': '⚠️ Outside Campus Bounds',
            'message': f'You are {distance_str} outside campus. Return immediately to avoid absent marking.',
            'timestamp': now_local.isoformat(),
            'dismissible': True,
            'distance_m': presence.distance_m
        })
    
    # 4. Lunch Period Alerts
    if flags['is_lunch_pre_alert']:
        notifications.append({
            'type': 'LUNCH_START_REMINDER',
            'level': 'INFO',
            'title': '🍽️ Lunch Break Starting Soon',
            'message': 'Lunch window starts at 1:00 PM. Lunch free-exit: 1:00 PM - 1:40 PM.',
            'timestamp': now_local.isoformat(),
            'dismissible': True
        })
    
    if flags['is_lunch_window']:
        notifications.append({
            'type': 'LUNCH_ACTIVE',
            'level': 'INFO',
            'title': '🍽️ Lunch Break Active',
            'message': 'You can exit campus during lunch. Return by 1:40 PM.',
            'timestamp': now_local.isoformat(),
            'dismissible': False
        })
    
    if flags['is_return_pre_alert']:
        notifications.append({
            'type': 'LUNCH_END_REMINDER',
            'level': 'WARNING',
            'title': '⏰ Lunch Ending Soon',
            'message': '10-minute warning: Lunch free-exit ends at 1:40 PM. Return to campus now!',
            'timestamp': now_local.isoformat(),
            'dismissible': True
        })
    
    # 5. Check Attendance Status Today
    today_log = AttendanceLog.query.filter_by(user_id=user_id, date=today_str).first()
    if today_log:
        if today_log.time_in and not today_log.time_out:
            notifications.append({
                'type': 'CHECKED_IN',
                'level': 'INFO',
                'title': '✅ Checked In',
                'message': f'You checked in at {today_log.time_in} as {today_log.check_in_status}',
                'timestamp': now_local.isoformat(),
                'dismissible': True
            })
        elif today_log.time_in and today_log.time_out:
            notifications.append({
                'type': 'FULL_DAY_MARKED',
                'level': 'SUCCESS',
                'title': '✨ Full Day Marked',
                'message': f'Check-in: {today_log.time_in} | Check-out: {today_log.time_out} | Status: {today_log.status}',
                'timestamp': now_local.isoformat(),
                'dismissible': True
            })
    else:
        # Not marked
        if flags['is_check_in_window']:
            notifications.append({
                'type': 'PENDING_CHECKIN',
                'level': 'INFO',
                'title': '📸 Mark Attendance',
                'message': 'Check-in window is open (9:00 AM - 9:45 AM). Mark your attendance now.',
                'timestamp': now_local.isoformat(),
                'dismissible': False
            })
    
    # 6. Check Permission Status
    permissions = PermissionRequest.query.filter_by(
        user_id=user_id,
        date=today_str,
        status='Approved'
    ).all()
    
    if permissions:
        perm_types = [p.type for p in permissions]
        notifications.append({
            'type': 'APPROVED_PERMISSIONS',
            'level': 'SUCCESS',
            'title': '✅ Permissions Approved',
            'message': f'You have approved permissions: {", ".join(perm_types)}',
            'timestamp': now_local.isoformat(),
            'dismissible': True
        })
    
    # 7. Check Security Alerts
    recent_alerts = SecurityAlert.query.filter_by(user_id=user_id).filter(
        SecurityAlert.created_at >= (now_utc - timedelta(hours=2))
    ).all()
    
    if recent_alerts:
        for alert in recent_alerts[:3]:  # Limit to 3 most recent
            notifications.append({
                'type': 'SECURITY_ALERT',
                'level': 'WARNING',
                'title': '🚨 Security Alert',
                'message': alert.event_message,
                'timestamp': alert.created_at.astimezone(local_tz).isoformat(),
                'dismissible': True,
                'code': alert.event_code
            })
    
    return jsonify({
        "success": True,
        "user_id": user_id,
        "timestamp": now_local.isoformat(),
        "timezone": "Asia/Kolkata",
        "notifications": notifications,
        "stats": {
            "critical": len([n for n in notifications if n['level'] == 'CRITICAL']),
            "warning": len([n for n in notifications if n['level'] == 'WARNING']),
            "info": len([n for n in notifications if n['level'] == 'INFO']),
            "success": len([n for n in notifications if n['level'] == 'SUCCESS']),
            "total": len(notifications)
        }
    }), 200

# --------- END NOTIFICATION API ---------

if __name__ == '__main__':
    # Reverting to standard HTTP (No SSL)
    # Note: Mobile browsers may block camera access on http://192.168.x.x
    app.run(debug=True, host='0.0.0.0', port=5000)
