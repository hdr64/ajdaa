import { prisma } from '../src/services/prisma.js';

async function main() {
  const inquiries = await prisma.customerInquiry.findMany({
    where: {
      OR: [
        { name: { startsWith: '[مطور]' } },
        { message: { contains: '[ملاحظة موجهة للمطور]' } },
      ],
    },
  });

  console.log(`Found ${inquiries.length} developer notes in CustomerInquiry table.`);

  for (const inq of inquiries) {
    const sectionMatch = inq.message?.match(/الصفحة:\s*([^\n]+)/);
    const section = sectionMatch ? sectionMatch[1].trim() : 'عام';

    const bodyMatch = inq.message?.match(
      /تفاصيل المشكلة \/ الملاحظة:\s*([\s\S]*?)(?:\nالحل المقترح:|\nلقطة الشاشة:|$)/
    );
    const body = bodyMatch ? bodyMatch[1].trim() : (inq.message || inq.name);

    const title = inq.name.replace(/^\[مطور\]\s*/, '').trim();

    await prisma.developerNote.create({
      data: {
        title,
        section,
        body,
        adminName: inq.name,
        adminEmail: inq.email,
        createdAt: inq.createdAt,
        status: 'pending',
        priority: 'medium',
      },
    });

    await prisma.customerInquiry.delete({
      where: { id: inq.id },
    });

    console.log(`Successfully migrated note: "${title}" and removed from CustomerInquiry.`);
  }

  const count = await prisma.developerNote.count();
  console.log(`Total records in DeveloperNote table: ${count}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
