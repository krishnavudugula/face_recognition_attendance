import sqlite3

def upgrade():
    try:
        conn = sqlite3.connect('instance/face_attendance.db')
        c = conn.cursor()
        try:
            c.execute('ALTER TABLE attendance_log ADD COLUMN modifier VARCHAR(20)')
        except sqlite3.OperationalError:
            pass # Column exists
            
        conn.commit()
        conn.close()
        print("AttendanceLog Migration successful")
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == '__main__':
    upgrade()
