import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';

async function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

  if (args.length < 2) {
    console.error('Usage: npm run make-admin -- <email> <password>');
    process.exit(1);
  }

  const [rawEmail, password] = args;
  const email = rawEmail.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error(`Error: "${email}" is not a valid email address.`);
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('Error: Password must be at least 6 characters long.');
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        isAdmin: true,
        isDisabled: false,
        passwordHash,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: updated.id,
        action: 'USER_PROMOTED_CLI',
        targetType: 'USER',
        targetId: updated.id,
        details: {
          note: 'User promoted to administrator and password reset via make-admin CLI',
          email,
        },
      },
    });

    console.log(`[SUCCESS] Existing user "${email}" (ID: ${updated.id}) has been made an ADMIN.`);
  } else {
    const defaultName = email.split('@')[0];
    const newUser = await prisma.user.create({
      data: {
        email,
        name: defaultName,
        passwordHash,
        isAdmin: true,
        isDisabled: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: newUser.id,
        action: 'ADMIN_CREATED_CLI',
        targetType: 'USER',
        targetId: newUser.id,
        details: {
          note: 'New administrator created via make-admin CLI',
          email,
        },
      },
    });

    console.log(`[SUCCESS] Created new ADMIN account "${email}" (ID: ${newUser.id}).`);
  }
}

main()
  .catch((err) => {
    console.error('[ERROR] Failed to make admin:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
