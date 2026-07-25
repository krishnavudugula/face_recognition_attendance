import sys
import datetime

file_path = 'c:/Users/krish/face-attendance-app/app.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''            
    except Exception as e:
        print(f"⚠️ Auto-mark attendance error: {str(e)}")
        db.session.rollback()'''

replacement = '''    with app.app_context():
        try:
            now_utc = datetime.utcnow()
            local_tz = pytz.timezone('Asia/Kolkata')
            now_local = now_utc.astimezone(local_tz)
            today_str = now_local.strftime('%Y-%m-%d')
            
            # Find all incomplete attendances for today (checked in but not checked out)
            incomplete_logs = AttendanceLog.query.filter_by(
                date=today_str
            ).filter(
                AttendanceLog.time_out == None  # No check-out yet
            ).all()
            
            if not incomplete_logs:
                print("✅ No incomplete attendances to auto-mark")
                return
            
            auto_marked_count = 0
            for log in incomplete_logs:
                first_status = (log.check_in_status or log.status or "").strip()
                
                # If they marked in morning but didn't mark in evening → ABSENT
                if first_status in {"Present", "Late Permission"}:
                    log.status = "Absent"
                    log.check_out_status = "Absent"
                    log.check_out_period = "18:00-24:00 (Auto-marked ABSENT - No evening mark)"
                    log.time_out = now_local.strftime('%H:%M:%S')
                    log.timestamp_out = now_utc
                    print(f"  📝 Auto-marked {log.user_id} as ABSENT (no evening mark by 6 PM)")
                    auto_marked_count += 1
                elif first_status in {"Absent", "Didn't Mark"}:
                    # Already absent, no action needed
                    pass
                elif first_status in {"HD", "EP", "Early Permission"}:
                    # Already marked as half-day or early departure, no action needed
                    pass
            
            if auto_marked_count > 0:
                db.session.commit()
                print(f"✅ Auto-marked {auto_marked_count} faculty as ABSENT (incomplete double marking)")
            else:
                print("💤 No attendances needed auto-marking")
                
        except Exception as e:
            print(f"⚠️ Auto-mark attendance error: {str(e)}")
            db.session.rollback()'''

# Handle line endings
content_norm = content.replace('\r\n', '\n')
target_norm = target.replace('\r\n', '\n')
replacement_norm = replacement.replace('\r\n', '\n')

if target_norm in content_norm:
    new_content = content_norm.replace(target_norm, replacement_norm)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Successfully replaced content.')
else:
    print('Target string not found in file.')
