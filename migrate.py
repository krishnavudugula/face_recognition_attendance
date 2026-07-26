from app import app, db, Holiday

with app.app_context():
    db.create_all()
    print("Database tables ensured.")
