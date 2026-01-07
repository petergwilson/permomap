#!/usr/bin/env node
/**
 * Password Hashing Utility
 * Usage: node hash-password.js <password>
 * 
 * This script generates bcrypt hashes for passwords that can be stored
 * in the permomap_users table.
 */

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
    console.error('Usage: node hash-password.js <password>');
    process.exit(1);
}

const saltRounds = 10;
bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error('Error hashing password:', err);
        process.exit(1);
    }
    console.log('\nHashed password:');
    console.log(hash);
    console.log('\nUse this hash in your SQL INSERT/UPDATE statement:');
    console.log(`UPDATE permomap_users SET password = '${hash}' WHERE username = 'your-username';`);
});
