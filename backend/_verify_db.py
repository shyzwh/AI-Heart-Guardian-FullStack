import sqlite3
from pathlib import Path

database_path = Path(__file__).resolve().parents[1] / "storage" / "ecg_web.db"
c = sqlite3.connect(database_path)
tables = [r[0] for r in c.execute("select name from sqlite_master where type='table' order by name")]
print("表:", tables)
for t in ["users", "patients", "ecg_records", "followups", "emergency_contacts", "health_checkins", "rehab_plans", "policy_articles"]:
    try:
        print(t, "行数=", c.execute(f"select count(*) from {t}").fetchone()[0])
    except sqlite3.Error as e:
        print(t, "缺失:", e)
print("ecg 风险分布:", c.execute("select risk_level,count(*) from ecg_records group by risk_level").fetchall())
print("用户:", c.execute("select username,role,is_active from users").fetchall())
print("患者:", c.execute("select id,name,gender,age,doctor_id from patients").fetchall())
sample = c.execute("select file_name,risk_level,risk_score,total_beats,status from ecg_records limit 3").fetchall()
print("样例记录:", sample)
