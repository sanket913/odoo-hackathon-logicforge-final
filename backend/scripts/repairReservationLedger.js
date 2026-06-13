import { prisma } from "../src/config/prisma.js";

const moves = await prisma.stockMove.findMany({
  where: { type: { in: ["SALE_RESERVE", "MO_COMPONENT_RESERVE", "RESERVATION_RELEASE"] } },
  include: { product: true },
  orderBy: [{ productId: "asc" }, { date: "asc" }],
});

const availableByProduct = new Map();

for (const move of moves) {
  const startingAvailable = availableByProduct.has(move.productId)
    ? availableByProduct.get(move.productId)
    : move.product.onHand;
  const delta = move.type === "RESERVATION_RELEASE"
    ? Math.abs(move.change)
    : -Math.abs(move.change);
  const nextAvailable = startingAvailable + delta;

  await prisma.stockMove.update({
    where: { id: move.id },
    data: { change: delta, before: startingAvailable, after: nextAvailable },
  });

  availableByProduct.set(move.productId, nextAvailable);
}

console.log(`Repaired ${moves.length} reservation ledger rows.`);

await prisma.$disconnect();
