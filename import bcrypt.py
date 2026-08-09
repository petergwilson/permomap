import bcrypt

password = b"andrew"
hashed = bcrypt.hashpw(password, bcrypt.gensalt(rounds=10))
print(hashed.decode())