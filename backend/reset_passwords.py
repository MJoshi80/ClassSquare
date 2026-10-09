"""
Password Management & Reset Tool for ClassSquare
Allows updating/refreshing user passwords directly in the SQLite database.

Usage:
    # Reset all default demo accounts to standard passwords (admin123, hod123, etc.):
    python reset_passwords.py --reset-all

    # Reset a specific user's password:
    python reset_passwords.py --email admin@opticlass.edu --password newpassword123

    # List all users in database:
    python reset_passwords.py --list
"""

import sys
import os
import argparse
from passlib.context import CryptContext

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.user import User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

STANDARD_PASSWORDS = {
    UserRole.admin: "admin123",
    UserRole.hod: "hod123",
    UserRole.faculty: "faculty123",
    UserRole.student: "student123",
}

def list_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"\n--- Total Users in Database: {len(users)} ---")
        print(f"{'ID':<4} | {'Role':<10} | {'Email':<35}")
        print("-" * 55)
        for u in users:
            print(f"{u.id:<4} | {u.role.value:<10} | {u.email:<35}")
        print()
    finally:
        db.close()

def update_user_password(email: str, new_password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email.strip()).first()
        if not user:
            print(f"[ERROR] User with email '{email}' not found.")
            return False
        
        user.password_hash = pwd_context.hash(new_password)
        db.commit()
        print(f"[SUCCESS] Password for '{email}' successfully updated.")
        return True
    finally:
        db.close()

def reset_all_demo_passwords():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        if not users:
            print("[INFO] No users found in database.")
            return

        print("\n--- Refreshing / Standardizing All Demo Passwords ---")
        for u in users:
            target_pwd = STANDARD_PASSWORDS.get(u.role, "password123")
            u.password_hash = pwd_context.hash(target_pwd)
            print(f"  [✓] {u.email:<32} ({u.role.value:<8}) -> {target_pwd}")
        
        db.commit()
        print("\nAll user passwords successfully refreshed!\n")
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ClassSquare Password Reset Tool")
    parser.add_argument("--list", action="store_true", help="List all registered users")
    parser.add_argument("--reset-all", action="store_true", help="Reset all accounts to standard demo passwords")
    parser.add_argument("--email", type=str, help="Email of user to update")
    parser.add_argument("--password", type=str, help="New password for user")

    args = parser.parse_args()

    if args.list:
        list_users()
    elif args.reset_all:
        reset_all_demo_passwords()
    elif args.email and args.password:
        update_user_password(args.email, args.password)
    else:
        # Default interactive behavior if no arguments given
        print("ClassSquare Password Manager")
        print("1. List all users")
        print("2. Reset all users to standard passwords (admin123, hod123, faculty123, student123)")
        print("3. Update specific user password")
        choice = input("Enter choice (1/2/3): ").strip()
        if choice == "1":
            list_users()
        elif choice == "2":
            reset_all_demo_passwords()
        elif choice == "3":
            em = input("Enter user email: ").strip()
            pw = input("Enter new password: ").strip()
            if em and pw:
                update_user_password(em, pw)
            else:
                print("Email and password cannot be empty.")
        else:
            parser.print_help()
