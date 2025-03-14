import bcrypt from 'bcrypt';
import postgres from 'postgres';
import { randomUUID } from 'crypto';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';

// Connect to Neon database
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function seedUsers() {
  console.log("Seeding users...");
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `;

  const insertedUsers = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      return sql`
        INSERT INTO users (id, name, email, password)
        VALUES (${randomUUID()}, ${user.name}, ${user.email}, ${hashedPassword})
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;
      `;
    })
  );

  console.log("Users seeded.");
  return insertedUsers;
}

async function seedCustomers() {
  console.log("Seeding customers...");
  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      image_url VARCHAR(255) NOT NULL
    );
  `;

  const insertedCustomers = await Promise.all(
    customers.map(
      (customer) => sql`
        INSERT INTO customers (id, name, email, image_url)
        VALUES (${randomUUID()}, ${customer.name}, ${customer.email}, ${customer.image_url})
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;
      `
    )
  );

  console.log("Customers seeded.");
  return insertedCustomers;
}

async function seedInvoices() {
  console.log("Seeding invoices...");
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY,
      customer_id UUID NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
  `;

  const insertedInvoices = await Promise.all(
    invoices.map(
      (invoice) => sql`
        INSERT INTO invoices (id, customer_id, amount, status, date)
        SELECT ${randomUUID()}, ${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date}
        WHERE EXISTS (SELECT 1 FROM customers WHERE id = ${invoice.customer_id})
        ON CONFLICT (id) DO NOTHING;
      `
    )
  );

  console.log("Invoices seeded.");
  return insertedInvoices;
}

async function seedRevenue() {
  console.log("Seeding revenue...");
  await sql`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) PRIMARY KEY,
      revenue INT NOT NULL
    );
  `;

  const insertedRevenue = await Promise.all(
    revenue.map(
      (rev) => sql`
        INSERT INTO revenue (month, revenue)
        VALUES (${rev.month}, ${rev.revenue})
        ON CONFLICT (month) DO UPDATE SET revenue = EXCLUDED.revenue;
      `
    )
  );

  console.log("Revenue seeded.");
  return insertedRevenue;
}

export async function GET() {
  try {
    console.log("Starting database seeding...");
    
    await sql.begin(async (sql) => {
      await seedUsers();
      await seedCustomers();
      await seedInvoices();
      await seedRevenue();
    });

    console.log("Database seeding completed.");
    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error("Seeding failed:", error);
    return Response.json({ error: error }, { status: 500 });
  }
}
