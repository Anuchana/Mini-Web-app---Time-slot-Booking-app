from fastapi import FastAPI, Depends
from sqlmodel import Session, text
from database import get_session

app = FastAPI()

@app.get("/api/test-db")
def test_database_connection(session: Session = Depends(get_session)):
    try:
        #Testing query
        session.exec(text("SELECT 1"))
        return {"status": "success", "message": "Successfully connected to Supabase!"}
    except Exception as e:
        return {"status": "error", "message": f"Connection failed: {str(e)}"}
