import sqlite3

def upgrade():
    try:
        # Assuming the database is at instance/face_attendance.db or similar.
        # Flask-SQLAlchemy usually puts it in the instance folder.
        conn = sqlite3.connect('instance/face_attendance.db')
        c = conn.cursor()
        try:
            c.execute('ALTER TABLE permission_request ADD COLUMN modifier VARCHAR(20)')
        except sqlite3.OperationalError:
            pass # Column exists
            
        try:
            c.execute('ALTER TABLE permission_request ADD COLUMN rules_override TEXT')
        except sqlite3.OperationalError:
            pass
            
        try:
            c.execute('ALTER TABLE permission_request ADD COLUMN granted_by_admin BOOLEAN DEFAULT 0')
        except sqlite3.OperationalError:
            pass
            
        conn.commit()
        conn.close()
        print("Migration successful")
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == '__main__':
    upgrade()
