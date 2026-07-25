import sqlite3
import os

db_path = 'c:\\Users\\krish\\face-attendance-app\\face_attendance.db'

def migrate():
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    columns_to_add = [
        ("valid_from", "DATETIME"),
        ("valid_until", "DATETIME"),
        ("priority", "INTEGER DEFAULT 0"),
        ("internal_notes", "VARCHAR(500)")
    ]
    
    for col_name, col_type in columns_to_add:
        try:
            c.execute(f"ALTER TABLE permission_request ADD COLUMN {col_name} {col_type};")
            print(f"Added column {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"Column {col_name} already exists.")
            else:
                print(f"Error adding {col_name}: {e}")
                
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == '__main__':
    migrate()
