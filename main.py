from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import timedelta
import random
import string

from database import get_db, SessionLocal, engine, Base
from schemas import *
from auth import get_current_user, get_admin_user, create_access_token, get_password_hash, verify_password, ACCESS_TOKEN_EXPIRE_MINUTES
from database import User, MenuItem, Order, OrderItem

# Create tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(title="Cafe Management System", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
import os
if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

# ==================== AUTH ENDPOINTS ====================

@app.post("/api/auth/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    db_email = db.query(User).filter(User.email == user.email).first()
    if db_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(username=user.username, email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/api/auth/login", response_model=Token)
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": db_user.username}, expires_delta=access_token_expires)
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# ==================== MENU ENDPOINTS ====================

@app.get("/api/menu", response_model=list[MenuItemResponse])
def get_menu(db: Session = Depends(get_db)):
    items = db.query(MenuItem).filter(MenuItem.is_available == True).all()
    return items

@app.get("/api/menu/{item_id}", response_model=MenuItemResponse)
def get_menu_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return item

@app.post("/api/menu", response_model=MenuItemResponse)
def create_menu_item(item: MenuItemCreate, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    db_item = MenuItem(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.put("/api/menu/{item_id}", response_model=MenuItemResponse)
def update_menu_item(item_id: int, item: MenuItemUpdate, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    db_item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    update_data = item.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/api/menu/{item_id}")
def delete_menu_item(item_id: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    db_item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    db.delete(db_item)
    db.commit()
    return {"message": "Menu item deleted successfully"}

# ==================== ORDER ENDPOINTS ====================

def generate_order_number():
    return "ORD-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

@app.post("/api/orders", response_model=OrderResponse)
def create_order(order: OrderCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not order.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")
    
    # Create order
    db_order = Order(
        user_id=current_user.id,
        order_number=generate_order_number(),
        payment_method=order.payment_method,
        status="pending"
    )
    
    total_amount = 0.0
    
    # Add order items
    for item_data in order.items:
        menu_item = db.query(MenuItem).filter(MenuItem.id == item_data.menu_item_id).first()
        if not menu_item:
            raise HTTPException(status_code=404, detail=f"Menu item {item_data.menu_item_id} not found")
        
        subtotal = menu_item.price * item_data.quantity
        order_item = OrderItem(
            order=db_order,
            menu_item_id=item_data.menu_item_id,
            quantity=item_data.quantity,
            price=menu_item.price,
            subtotal=subtotal
        )
        db_order.order_items.append(order_item)
        total_amount += subtotal
    
    db_order.total_amount = total_amount
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    return db_order

@app.get("/api/orders", response_model=list[OrderResponse])
def get_user_orders(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.user_id == current_user.id).all()
    return orders

@app.get("/api/orders/admin/all", response_model=list[OrderResponse])
def get_all_orders(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    orders = db.query(Order).all()
    return orders

@app.get("/api/orders/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this order")
    
    return order

@app.put("/api/orders/{order_id}", response_model=OrderResponse)
def update_order_status(order_id: int, status_update: OrderStatusUpdate, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status_update.status
    if status_update.status == "completed":
        from datetime import datetime
        order.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(order)
    return order

# ==================== ADMIN DASHBOARD ENDPOINTS ====================

@app.get("/api/dashboard/stats")
def get_dashboard_stats(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    total_orders = db.query(Order).count()
    completed_orders = db.query(Order).filter(Order.status == "completed").count()
    total_revenue = 0.0
    
    completed = db.query(Order).filter(Order.status == "completed").all()
    for order in completed:
        total_revenue += order.total_amount
    
    total_items = db.query(MenuItem).count()
    
    return {
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "total_revenue": round(total_revenue, 2),
        "total_menu_items": total_items
    }

@app.get("/api/dashboard/sales")
def get_sales_data(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.status == "completed").all()
    
    sales_by_category = {}
    for order in orders:
        for item in order.order_items:
            category = item.menu_item.category
            if category not in sales_by_category:
                sales_by_category[category] = {"count": 0, "revenue": 0.0}
            sales_by_category[category]["count"] += item.quantity
            sales_by_category[category]["revenue"] += item.subtotal
    
    return sales_by_category

@app.post("/api/admin/create")
def create_admin(username: str, email: str, password: str, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = get_password_hash(password)
    new_admin = User(username=username, email=email, hashed_password=hashed_password, is_admin=True)
    db.add(new_admin)
    db.commit()
    
    return {"message": "Admin created successfully"}

# Root endpoint
@app.get("/")
def root():
    return {"message": "Cafe Management System API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
