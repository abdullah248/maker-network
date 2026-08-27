 
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(days: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

const WEEKDAY_HOURS = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  opensAt: 9 * 60,
  closesAt: 20 * 60,
  isClosed: false,
}));

async function main() {
  console.log("Seeding Maker Network demo data…");

  // Clear demo rows so the seed is idempotent.
  await prisma.review.deleteMany();
  await prisma.portfolioItem.deleteMany();
  await prisma.message.deleteMany();
  await prisma.printRequest.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.operatingHours.deleteMany();
  await prisma.material.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  const libraryUser = await prisma.user.create({
    data: {
      name: "Cedar Park Public Library",
      email: "makerspace@cedarparklibrary.example",
      accountType: "MAKERSPACE",
      onboardedAt: new Date(),
    },
  });

  const library = await prisma.profile.create({
    data: {
      userId: libraryUser.id,
      type: "MAKERSPACE",
      slug: "cedar-park-library",
      displayName: "Cedar Park Public Library — The Forge",
      headline: "Free 3D printing and laser cutting for cardholders",
      bio: "The Forge is our second-floor makerspace. Anyone with a Cedar Park library card can book a machine for free; we only charge for materials at cost. Staff are on hand Tuesday through Saturday to help with your first print.",
      city: "Cedar Park",
      region: "TX",
      country: "US",
      postalCode: "78613",
      websiteUrl: "https://example.com/cedar-park-forge",
      contactEmail: "makerspace@cedarparklibrary.example",
      phone: "(512) 555-0134",
      requiresAppointment: true,
      requiresMembership: false,
      requiresLibraryCard: true,
      membershipDetails:
        "A free Cedar Park library card is required. Out-of-district cards are $25/year.",
      accessNotes:
        "Complete the 30-minute safety orientation before your first booking. Under-16s must be accompanied by an adult.",
      acceptingRequests: true,
      published: true,
      operatingHours: {
        create: [
          { dayOfWeek: 0, opensAt: 0, closesAt: 0, isClosed: true },
          { dayOfWeek: 1, opensAt: 0, closesAt: 0, isClosed: true, note: "Staff training day" },
          { dayOfWeek: 2, opensAt: 10 * 60, closesAt: 19 * 60, isClosed: false },
          { dayOfWeek: 3, opensAt: 10 * 60, closesAt: 19 * 60, isClosed: false },
          { dayOfWeek: 4, opensAt: 10 * 60, closesAt: 19 * 60, isClosed: false },
          { dayOfWeek: 5, opensAt: 10 * 60, closesAt: 17 * 60, isClosed: false },
          { dayOfWeek: 6, opensAt: 11 * 60, closesAt: 16 * 60, isClosed: false },
        ],
      },
      machines: {
        create: [
          {
            category: "FDM_3D_PRINTER",
            make: "Prusa Research",
            model: "MK4S",
            buildVolume: "250 x 210 x 220 mm",
            quantity: 4,
            notes: "Four identical machines in the print bay. PLA and PETG only.",
          },
          {
            category: "LASER_CUTTER",
            make: "Epilog",
            model: "Fusion Pro 36",
            buildVolume: "914 x 610 mm bed",
            quantity: 1,
            perJobFee: 5,
            notes: "60 W CO2. Staff-operated for first-time users. No PVC or vinyl.",
          },
          {
            category: "VINYL_CUTTER",
            make: "Cricut",
            model: "Maker 3",
            quantity: 2,
          },
          {
            category: "EMBROIDERY_MACHINE",
            make: "Brother",
            model: "PE800",
            buildVolume: "127 x 178 mm hoop",
            quantity: 1,
          },
        ],
      },
      materials: {
        create: [
          {
            category: "FILAMENT",
            name: "PLA",
            brand: "Prusament",
            colors: "Galaxy Black, Jet Black, Lipstick Red, Ocean Blue, Signal White",
            specs: "1.75 mm, 1 kg spool",
            unit: "GRAM",
            pricePerUnit: 0.04,
            inStock: true,
            notes: "Sold at cost by weight; we weigh your print when it comes off the bed.",
          },
          {
            category: "FILAMENT",
            name: "PETG",
            brand: "Prusament",
            colors: "Clear, Urban Grey, Neon Green",
            specs: "1.75 mm, 1 kg spool",
            unit: "GRAM",
            pricePerUnit: 0.05,
            inStock: true,
          },
          {
            category: "SHEET_WOOD",
            name: "Baltic birch plywood",
            specs: "3 mm, 600 x 300 mm",
            unit: "SHEET",
            pricePerUnit: 6.5,
            stockQuantity: 40,
            inStock: true,
          },
          {
            category: "SHEET_ACRYLIC",
            name: "Cast acrylic (clear)",
            specs: "3 mm, 600 x 300 mm",
            unit: "SHEET",
            pricePerUnit: 9,
            stockQuantity: 12,
            inStock: true,
          },
          {
            category: "PAPER_CARD",
            name: "Cardstock",
            specs: "216 gsm, letter",
            unit: "SHEET",
            pricePerUnit: 0.25,
            inStock: true,
          },
        ],
      },
    },
    include: { machines: true },
  });

  const laser = library.machines.find((machine) => machine.category === "LASER_CUTTER");
  await prisma.availabilitySlot.createMany({
    data: [
      { profileId: library.id, machineId: laser?.id, startsAt: daysFromNow(1, 10), endsAt: daysFromNow(1, 12), status: "OPEN", note: "Staff-assisted laser session" },
      { profileId: library.id, machineId: laser?.id, startsAt: daysFromNow(1, 13), endsAt: daysFromNow(1, 15), status: "OPEN" },
      { profileId: library.id, machineId: laser?.id, startsAt: daysFromNow(2, 10), endsAt: daysFromNow(2, 12), status: "BOOKED" },
      { profileId: library.id, startsAt: daysFromNow(3, 10), endsAt: daysFromNow(3, 16), status: "OPEN", note: "Open print bay — drop in" },
      { profileId: library.id, startsAt: daysFromNow(5, 11), endsAt: daysFromNow(5, 15), status: "OPEN" },
    ],
  });

  const hackerspaceUser = await prisma.user.create({
    data: {
      name: "Bramble Street Hackerspace",
      email: "hello@bramblestreet.example",
      accountType: "MAKERSPACE",
      onboardedAt: new Date(),
    },
  });

  await prisma.profile.create({
    data: {
      userId: hackerspaceUser.id,
      type: "MAKERSPACE",
      slug: "bramble-street",
      displayName: "Bramble Street Hackerspace",
      headline: "Member-run shop with CNC, laser and a full electronics bench",
      bio: "A 4,000 sq ft member-run workshop in East Austin. Day passes available; members get 24/7 door access.",
      city: "Austin",
      region: "TX",
      country: "US",
      websiteUrl: "https://example.com/bramble",
      requiresAppointment: false,
      requiresMembership: true,
      requiresLibraryCard: false,
      membershipDetails: "$65/month, or a $20 day pass. Tool-specific checkouts required for CNC and laser.",
      accessNotes: "Closed-toe shoes required in the machine shop.",
      acceptingRequests: true,
      published: true,
      operatingHours: { create: WEEKDAY_HOURS },
      machines: {
        create: [
          { category: "CNC_ROUTER", make: "Shapeoko", model: "4 XXL", buildVolume: "838 x 838 x 101 mm", quantity: 1, hourlyRate: 15 },
          { category: "LASER_CUTTER", make: "Thunder Laser", model: "Nova 35", buildVolume: "900 x 600 mm bed", quantity: 1, hourlyRate: 20 },
          { category: "FDM_3D_PRINTER", make: "Bambu Lab", model: "X1 Carbon", buildVolume: "256 x 256 x 256 mm", quantity: 3 },
          { category: "RESIN_3D_PRINTER", make: "Elegoo", model: "Saturn 4 Ultra", buildVolume: "218 x 123 x 220 mm", quantity: 1 },
        ],
      },
      materials: {
        create: [
          { category: "FILAMENT", name: "PLA", unit: "KG", pricePerUnit: 22, inStock: true, colors: "Black, White, Grey" },
          { category: "FILAMENT", name: "ASA", unit: "KG", pricePerUnit: 34, inStock: true, specs: "1.75 mm, UV stable" },
          { category: "SHEET_WOOD", name: "MDF", unit: "SHEET", pricePerUnit: 4, stockQuantity: 60, inStock: true, specs: "3 mm, 600 x 300 mm" },
          { category: "RESIN", name: "Standard photopolymer resin", unit: "LITER", pricePerUnit: 42, inStock: false, canCustomOrder: true, customOrderLeadDays: 5 },
        ],
      },
    },
  });

  const adaUser = await prisma.user.create({
    data: {
      name: "Ada Okafor",
      email: "ada@example.com",
      accountType: "INDIVIDUAL",
      onboardedAt: new Date(),
    },
  });

  const ada = await prisma.profile.create({
    data: {
      userId: adaUser.id,
      type: "INDIVIDUAL",
      slug: "ada-prints",
      displayName: "Ada's Print Bench",
      headline: "Multi-colour FDM prints, shipped nationwide",
      bio: "I run four printers out of my garage in South Austin. Happy to do one-off prototypes, cosplay parts and small batch runs. Send me an STL or a sketch and I will quote it.",
      city: "Austin",
      region: "TX",
      country: "US",
      offersShipping: true,
      offersLocalPickup: true,
      canCustomOrderMaterials: true,
      customOrderNotes:
        "I can order almost any filament colour or specialty material — typically 3-5 business days plus cost.",
      contactEmail: "ada@example.com",
      acceptingRequests: true,
      published: true,
      machines: {
        create: [
          { category: "FDM_3D_PRINTER", make: "Bambu Lab", model: "X1 Carbon", buildVolume: "256 x 256 x 256 mm", quantity: 2, nickname: "The workhorses" },
          { category: "FDM_3D_PRINTER", make: "Bambu Lab", model: "A1 mini", buildVolume: "180 x 180 x 180 mm", quantity: 2 },
          { category: "RESIN_3D_PRINTER", make: "Elegoo", model: "Mars 5 Ultra", buildVolume: "153 x 77 x 165 mm", quantity: 1 },
        ],
      },
      materials: {
        create: [
          { category: "FILAMENT", name: "PLA", brand: "Bambu Lab", colors: "Black, White, Red, Blue, Green, Silver, Gold", unit: "GRAM", pricePerUnit: 0.06, inStock: true },
          { category: "FILAMENT", name: "PETG", brand: "Overture", colors: "Clear, Black", unit: "GRAM", pricePerUnit: 0.07, inStock: true },
          { category: "FILAMENT", name: "TPU 95A", brand: "SainSmart", colors: "Black", unit: "GRAM", pricePerUnit: 0.11, inStock: true, specs: "Flexible, 95A shore" },
          { category: "FILAMENT", name: "Carbon fibre PETG-CF", unit: "GRAM", pricePerUnit: 0.14, inStock: false, canCustomOrder: true, customOrderLeadDays: 4 },
          { category: "RESIN", name: "Tough / ABS-like resin", unit: "ML", pricePerUnit: 0.09, inStock: true },
        ],
      },
    },
  });

  const marcusUser = await prisma.user.create({
    data: {
      name: "Marcus Lindqvist",
      email: "marcus@example.com",
      accountType: "INDIVIDUAL",
      onboardedAt: new Date(),
    },
  });

  await prisma.profile.create({
    data: {
      userId: marcusUser.id,
      type: "INDIVIDUAL",
      slug: "lindqvist-laser",
      displayName: "Lindqvist Laser & Engraving",
      headline: "Laser engraving on wood, leather and anodised aluminium",
      bio: "Weekend laser work out of a home shop in Round Rock. Local pickup only — I do not ship.",
      city: "Round Rock",
      region: "TX",
      country: "US",
      offersShipping: false,
      offersLocalPickup: true,
      canCustomOrderMaterials: false,
      acceptingRequests: true,
      published: true,
      machines: {
        create: [
          { category: "LASER_CUTTER", make: "xTool", model: "P2S", buildVolume: "600 x 308 mm bed", quantity: 1, perJobFee: 12 },
          { category: "LASER_CUTTER", make: "xTool", model: "F1 Ultra", buildVolume: "220 x 220 mm bed", quantity: 1, notes: "Fiber laser — metal marking" },
        ],
      },
      materials: {
        create: [
          { category: "SHEET_WOOD", name: "Hardwood (maple)", unit: "SHEET", pricePerUnit: 14, inStock: true, specs: "6 mm, 300 x 300 mm" },
          { category: "SHEET_METAL", name: "Anodised aluminium", unit: "SHEET", pricePerUnit: 8, inStock: true, specs: "1 mm, engrave only" },
          { category: "OTHER", name: "Veg-tan leather", unit: "SQ_FOOT", pricePerUnit: 11, inStock: true },
        ],
      },
    },
  });

  const customer = await prisma.user.create({
    data: { name: "Jamie Rivera", email: "jamie@example.com", accountType: "CUSTOMER", onboardedAt: new Date() },
  });

  // An intentionally unpublished profile, used to verify draft visibility rules.
  const draftUser = await prisma.user.create({
    data: {
      name: "Quiet Workshop",
      email: "draft@example.com",
      accountType: "INDIVIDUAL",
      onboardedAt: new Date(),
    },
  });
  await prisma.profile.create({
    data: {
      userId: draftUser.id,
      type: "INDIVIDUAL",
      slug: "secret-draft-profile",
      displayName: "Quiet Workshop (draft)",
      headline: "Not published yet",
      city: "Austin",
      region: "TX",
      country: "US",
      published: false,
      offersLocalPickup: true,
    },
  });

  const conversation = await prisma.conversation.create({
    data: {
      requesterId: customer.id,
      providerProfileId: ada.id,
      subject: "Replacement knob for a vintage radio",
      lastMessageAt: new Date(),
      messages: {
        create: [
          {
            senderId: customer.id,
            body: "Hi Ada! I need one replacement knob for a 1960s radio. I have calipers and can send dimensions, or a photo with a ruler. Black PLA is fine. Could you ship to 78704?",
          },
          {
            senderId: adaUser.id,
            body: "Absolutely — send the dimensions and I'll model it. A single knob in black PLA is about $8 including shipping, usually done within two days.",
          },
        ],
      },
      request: {
        create: {
          title: "Replacement knob for a vintage radio",
          description:
            "One knob, roughly 24 mm diameter, D-shaft. Happy to provide caliper measurements. Black PLA preferred.",
          quantity: 1,
          fulfillment: "SHIPPING",
          budgetCents: 1500,
          deadline: daysFromNow(14, 12),
          status: "ACCEPTED",
        },
      },
    },
  });

  // ---------------------------------------------------------------------
  // Project gallery
  // ---------------------------------------------------------------------

  const adaMachines = await prisma.machine.findMany({ where: { profileId: ada.id } });
  const adaX1 = adaMachines.find((machine) => machine.model === "X1 Carbon");

  await prisma.portfolioItem.createMany({
    data: [
      {
        profileId: ada.id,
        machineId: adaX1?.id ?? null,
        title: "Articulated dragon, multi-colour",
        description:
          "Printed in one piece with a four-colour AMS swap. No supports, roughly nine hours on the X1C.",
        imageUrl: "https://picsum.photos/seed/articulated-dragon/1200/800",
        altText: "A multi-coloured articulated 3D printed dragon on a workbench",
        materialUsed: "Bambu Lab PLA",
        featured: true,
        sortOrder: 0,
      },
      {
        profileId: ada.id,
        machineId: adaX1?.id ?? null,
        title: "Replacement gear for a coffee grinder",
        description: "Reverse-engineered from a broken original. PETG for heat resistance.",
        imageUrl: "https://images.unsplash.com/photo-1611117775350-ac3950990985?w=1200&q=80",
        altText: "A small 3D printed replacement gear held between two fingers",
        materialUsed: "Overture PETG",
        sortOrder: 1,
      },
      {
        profileId: ada.id,
        title: "Cosplay pauldron shells",
        description: "Two-part shells, sanded and primed, ready for painting.",
        imageUrl: "https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=1200&q=80",
        altText: "Two large 3D printed armour shells drying on a bench",
        materialUsed: "PLA+",
        sortOrder: 2,
      },
    ],
  });

  await prisma.portfolioItem.createMany({
    data: [
      {
        profileId: library.id,
        title: "Community sign for the reading garden",
        description:
          "Cut and engraved on the Epilog by a teen volunteer group during a Saturday workshop.",
        imageUrl: "https://images.unsplash.com/photo-1516131206008-dd041a9764fd?w=1200&q=80",
        altText: "A laser engraved wooden sign mounted on a garden fence",
        materialUsed: "Baltic birch plywood",
        featured: true,
        sortOrder: 0,
      },
      {
        profileId: library.id,
        title: "Braille labels for the shelving",
        description: "Printed on the Prusa farm and fitted across the non-fiction stacks.",
        imageUrl: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&q=80",
        altText: "Small 3D printed shelf labels with raised braille dots",
        materialUsed: "Prusament PLA",
        sortOrder: 1,
      },
    ],
  });

  // ---------------------------------------------------------------------
  // Reviews
  // ---------------------------------------------------------------------

  const reviewers = await Promise.all(
    [
      { name: "Priya Raman", email: "priya@example.com" },
      { name: "Tom Alvarez", email: "tom@example.com" },
      { name: "Nadia Hassan", email: "nadia@example.com" },
    ].map((data) => prisma.user.create({ data: { ...data, accountType: "CUSTOMER" } })),
  );

  await prisma.review.createMany({
    data: [
      {
        profileId: ada.id,
        authorId: reviewers[0].id,
        rating: 5,
        title: "Rescued a project on a deadline",
        body: "Ada turned a rough sketch into a printed part in two days and shipped it the same week. Communication was excellent throughout.",
        verified: true,
      },
      {
        profileId: ada.id,
        authorId: reviewers[1].id,
        rating: 4,
        title: "Great quality, slight delay",
        body: "The print quality was better than I expected for the price. It arrived a couple of days later than estimated, but Ada kept me updated the whole time.",
        providerResponse:
          "Thanks Tom — that was my filament order running late. Glad the part worked out!",
        providerRespondedAt: new Date(),
      },
      {
        profileId: library.id,
        authorId: reviewers[2].id,
        rating: 5,
        title: "Free, friendly and genuinely accessible",
        body: "Booked the laser cutter with nothing but a library card. The staff walked me through the safety orientation and helped me fix my file. Materials are sold at cost.",
        verified: true,
      },
      {
        profileId: library.id,
        authorId: reviewers[0].id,
        rating: 4,
        body: "Great equipment and helpful staff. Booking can fill up fast on weekends, so plan ahead.",
      },
    ],
  });

  // Keep the denormalised aggregates consistent with the seeded reviews.
  for (const profileId of [ada.id, library.id]) {
    const aggregate = await prisma.review.aggregate({
      where: { profileId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.profile.update({
      where: { id: profileId },
      data: {
        ratingAverage: Math.round((aggregate._avg.rating ?? 0) * 100) / 100,
        ratingCount: aggregate._count.rating,
      },
    });
  }

  console.log(
    `Seed complete: ${await prisma.profile.count()} profiles, ${await prisma.machine.count()} machines, ${await prisma.material.count()} materials, ${await prisma.portfolioItem.count()} projects, ${await prisma.review.count()} reviews, conversation ${conversation.id}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
