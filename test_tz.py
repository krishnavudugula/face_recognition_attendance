from app import app, db, OTPVerification
import pytz
from datetime import datetime

with app.app_context():
    record = OTPVerification.query.first()
    if record:
        print("Expires at:", record.expires_at)
        print("Type:", type(record.expires_at))
        print("Has tzinfo?", record.expires_at.tzinfo is not None)
        try:
            print("Comparison:", datetime.now(pytz.utc) > record.expires_at)
        except Exception as e:
            print("Exception during comparison:", type(e).__name__, "-", e)
    else:
        print("No records found.")
