from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select
from pydantic import BaseModel
from database import engine, get_session
from models import Bookings
from contextlib import asynccontextmanager
from contextlib import asynccontextmanager
from typing import Optional
from datetime import date, time
from fastapi import FastAPI, Depends, HTTPException, Query

# Automatically create tables on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield

app = FastAPI(lifespan=lifespan)

# Enable CORS so the React frontend can communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)

# Pydantic model specifically for receiving the delete code safely
class DeleteRequest(BaseModel):
    delete_code: str


# Create booking endpoint with overlap validation
@app.post("/api/bookings")
def create_booking(booking: Bookings, session: Session = Depends(get_session)):
    # Overlap validation logic
    statement = select(Bookings).where(
        Bookings.booking_date == booking.booking_date,
        Bookings.start_time < booking.end_time,
        Bookings.end_time > booking.start_time
    )
    
    overlapping_bookings = session.exec(statement).first()
    
    if overlapping_bookings:
        raise HTTPException(
            status_code=400, 
            detail="This time slot overlaps with an existing booking."
        )

    session.add(booking)
    session.commit()
    session.refresh(booking)
    return {"status": "success", "data": booking}


# Get bookings endpoint with dynamic sorting and filtering
@app.get("/api/bookings")
def get_bookings(
    sort_by: str = Query("date", description="Sort by 'date' or 'priority'"), 
    filter_date: Optional[date] = Query(None, description="Filter by exact date (YYYY-MM-DD)"),
    filter_start_time: Optional[time] = Query(None, description="Filter by minimum start time (HH:MM:SS)"),
    filter_end_time: Optional[time] = Query(None, description="Filter by maximum end time (HH:MM:SS)"),
    session: Session = Depends(get_session)
):
    statement = select(Bookings)
    
    # Apply dynamic filters if the user provides them
    if filter_date:
        statement = statement.where(Bookings.booking_date == filter_date)
    if filter_start_time:
        statement = statement.where(Bookings.start_time >= filter_start_time)
    if filter_end_time:
        statement = statement.where(Bookings.end_time <= filter_end_time)

    # Apply sorting
    if sort_by == "priority":
        statement = statement.order_by(Bookings.priority, Bookings.booking_date, Bookings.start_time)
    else:
        statement = statement.order_by(Bookings.booking_date, Bookings.start_time)
        
    bookings = session.exec(statement).all()
    return {"status": "success", "data": bookings}


# Delete booking endpoint with delete code verification
@app.delete("/api/bookings/{booking_id}")
def delete_booking(booking_id: int, payload: DeleteRequest, session: Session = Depends(get_session)):
    # Find the specific booking by its ID
    booking = session.get(Bookings, booking_id)
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
        
    # Verify the delete code matches
    if booking.delete_code != payload.delete_code:
        raise HTTPException(status_code=403, detail="Invalid delete code. You cannot delete this booking.")
        
    session.delete(booking)
    session.commit()
    return {"status": "success", "message": "Booking deleted successfully."}