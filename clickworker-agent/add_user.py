#!/usr/bin/env python3
"""
USER MANAGEMENT SCRIPT
Add, modify, or remove users from the monitoring system
"""
import sqlite3
import sys
from werkzeug.security import generate_password_hash
from datetime import datetime

DB_PATH = '/tmp/clickworker_monitoring_multiuser.db'

def add_user(username, password, email, role='researcher'):
    """Add a new user to the system"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if user exists
    cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
    if cursor.fetchone():
        print(f"❌ User '{username}' already exists!")
        conn.close()
        return False

    # Add user
    password_hash = generate_password_hash(password)
    cursor.execute('''
        INSERT INTO users (username, password_hash, email, role, created_at)
        VALUES (?, ?, ?, ?, ?)
    ''', (username, password_hash, email, role, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))

    conn.commit()
    conn.close()

    print(f"✅ User '{username}' created successfully!")
    print(f"   Username: {username}")
    print(f"   Email: {email}")
    print(f"   Role: {role}")
    print(f"\n   Login at: http://localhost:5000/login")
    return True

def list_users():
    """List all users"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('SELECT id, username, email, role, created_at, last_login FROM users ORDER BY id')
    users = cursor.fetchall()
    conn.close()

    if not users:
        print("No users found.")
        return

    print("\n" + "="*80)
    print(f"{'ID':<5} {'Username':<15} {'Email':<30} {'Role':<12} {'Last Login':<20}")
    print("="*80)

    for user in users:
        last_login = user[5] if user[5] else 'Never'
        print(f"{user[0]:<5} {user[1]:<15} {user[2]:<30} {user[3]:<12} {last_login:<20}")

    print("="*80)
    print(f"Total users: {len(users)}\n")

def change_password(username, new_password):
    """Change user password"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    password_hash = generate_password_hash(new_password)
    cursor.execute('UPDATE users SET password_hash = ? WHERE username = ?',
                  (password_hash, username))

    if cursor.rowcount > 0:
        conn.commit()
        conn.close()
        print(f"✅ Password changed for user '{username}'")
        return True
    else:
        conn.close()
        print(f"❌ User '{username}' not found")
        return False

def delete_user(username):
    """Delete a user"""
    if username == 'admin':
        print("❌ Cannot delete admin user!")
        return False

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('DELETE FROM users WHERE username = ?', (username,))

    if cursor.rowcount > 0:
        conn.commit()
        conn.close()
        print(f"✅ User '{username}' deleted")
        return True
    else:
        conn.close()
        print(f"❌ User '{username}' not found")
        return False

def main():
    """Main CLI interface"""
    if len(sys.argv) < 2:
        print("""
╔══════════════════════════════════════════════════════════════════════╗
║                    USER MANAGEMENT TOOL                              ║
║          Clickworker Agent Monitoring - Multi-User Edition           ║
╚══════════════════════════════════════════════════════════════════════╝

Usage:
  python3 add_user.py add <username> <password> <email> [role]
  python3 add_user.py list
  python3 add_user.py password <username> <new_password>
  python3 add_user.py delete <username>

Roles:
  - admin      : Full access, can manage users
  - researcher : Can run agents and view own data
  - viewer     : Read-only access

Examples:
  python3 add_user.py add john pass123 john@example.com researcher
  python3 add_user.py list
  python3 add_user.py password john newpass456
  python3 add_user.py delete john
        """)
        return

    command = sys.argv[1]

    if command == 'add':
        if len(sys.argv) < 5:
            print("❌ Usage: add_user.py add <username> <password> <email> [role]")
            return
        username = sys.argv[2]
        password = sys.argv[3]
        email = sys.argv[4]
        role = sys.argv[5] if len(sys.argv) > 5 else 'researcher'
        add_user(username, password, email, role)

    elif command == 'list':
        list_users()

    elif command == 'password':
        if len(sys.argv) < 4:
            print("❌ Usage: add_user.py password <username> <new_password>")
            return
        username = sys.argv[2]
        new_password = sys.argv[3]
        change_password(username, new_password)

    elif command == 'delete':
        if len(sys.argv) < 3:
            print("❌ Usage: add_user.py delete <username>")
            return
        username = sys.argv[2]
        confirm = input(f"⚠️  Are you sure you want to delete user '{username}'? (yes/no): ")
        if confirm.lower() == 'yes':
            delete_user(username)
        else:
            print("Cancelled.")

    else:
        print(f"❌ Unknown command: {command}")
        print("Valid commands: add, list, password, delete")

if __name__ == '__main__':
    main()
