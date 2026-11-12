import Order from "../models/order.js";
import Product from "../models/product.js";
import User from "../models/user.js";
import Consultation from "../models/consultation.js";
import CustomRequest from "../models/customRequest.js";
import { handleError } from "../utils/controllerHelpers.js";

const LOW_STOCK = 5;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const PERIODS = {
  week: { label: "the last 7 days", comparedTo: "the 7 days before" },
  month: { label: "the last 4 weeks", comparedTo: "the 4 weeks before" },
  year: { label: "the last 12 months", comparedTo: "the 12 months before" },
};

function buildWindow(period) {
  const today = startOfDay(new Date());
  const buckets = [];
  let previousStart;

  if (period === "week") {
    for (let i = 6; i >= 0; i -= 1) {
      const start = addDays(today, -i);
      buckets.push({
        start,
        end: addDays(start, 1),
        label: start.toLocaleDateString("en-GB", { weekday: "short" }),
      });
    }
    previousStart = addDays(buckets[0].start, -7);
  } else if (period === "month") {
    const first = addDays(today, 1 - 28);
    for (let i = 0; i < 4; i += 1) {
      const start = addDays(first, i * 7);
      buckets.push({
        start,
        end: addDays(start, 7),
        label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      });
    }
    previousStart = addDays(first, -28);
  } else {
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      buckets.push({
        start,
        end: new Date(start.getFullYear(), start.getMonth() + 1, 1),
        label: start.toLocaleDateString("en-GB", { month: "short" }),
      });
    }
    previousStart = new Date(today.getFullYear(), today.getMonth() - 23, 1);
  }

  return {
    buckets,
    start: buckets[0].start,
    end: buckets[buckets.length - 1].end,
    previousStart,
  };
}

async function salesFor(period) {
  const { buckets, start, end, previousStart } = buildWindow(period);

  const orders = await Order.find({
    status: { $ne: "Cancelled" },
    createdAt: { $gte: previousStart, $lt: end },
  })
    .select("total items createdAt")
    .lean();

  const points = buckets.map(({ label }) => ({ label, value: 0, orders: 0 }));
  const lines = new Map(); // productId -> { product, name, units, revenue }
  let total = 0;
  let previousTotal = 0;
  let orderCount = 0;
  let itemCount = 0;

  for (const order of orders) {
    const placed = new Date(order.createdAt);

    if (placed < start) {
      previousTotal += order.total;
      continue;
    }

    const index = buckets.findIndex((b) => placed >= b.start && placed < b.end);
    if (index === -1) continue;

    points[index].value += order.total;
    points[index].orders += 1;
    total += order.total;
    orderCount += 1;

    for (const item of order.items) {
      itemCount += item.quantity;
      const key = String(item.product);
      const line = lines.get(key) ?? {
        product: item.product,
        name: item.name,
        units: 0,
        revenue: 0,
      };
      line.units += item.quantity;
      line.revenue += item.price * item.quantity;
      lines.set(key, line);
    }
  }

  const products = await Product.find({ _id: { $in: [...lines.keys()] } })
    .select("images category")
    .populate("category", "name")
    .lean();
  const info = new Map(products.map((product) => [String(product._id), product]));

  const byCategoryMap = new Map();
  const ranked = [...lines.values()].map((line) => {
    const product = info.get(String(line.product));
    const category = product?.category?.name ?? "Other";
    byCategoryMap.set(category, (byCategoryMap.get(category) ?? 0) + line.revenue);

    return {
      id: line.product,
      name: line.name,
      category,
      image: product?.images?.[0] ?? null,
      units: line.units,
      revenue: line.revenue,
    };
  });

  const itemsRevenue = ranked.reduce((sum, row) => sum + row.revenue, 0);
  const byCategory = [...byCategoryMap.entries()]
    .map(([name, revenue]) => ({
      name,
      revenue,
      percent: itemsRevenue ? Math.round((revenue / itemsRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    period,
    label: PERIODS[period].label,
    comparedTo: PERIODS[period].comparedTo,
    points,
    total,
    previousTotal,
    change: previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null,
    orders: orderCount,
    items: itemCount,
    averageOrder: orderCount ? Math.round(total / orderCount) : 0,
    byCategory,
    topProducts: ranked.sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  };
}

// GET /stats/sales  (admin)
export const getSales = async (req, res) => {
  try {
    const period = PERIODS[req.query.period] ? req.query.period : "week";
    res.json(await salesFor(period));
  } catch (error) {
    handleError(res, error);
  }
};

// GET /stats/dashboard  (admin)
export const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const weekAgo = addDays(today, -7);
    const monthAgo = addDays(today, -30);

    const [
      productTotal,
      lowStock,
      outOfStock,
      lowStockItems,
      orderTotal,
      ordersThisWeek,
      statusRows,
      revenueRows,
      recentOrders,
      customerTotal,
      newCustomers,
      pendingConsultations,
      openCustomRequests,
      quotedRequests,
      recentConsultations,
      recentCustomRequests,
      week,
      month,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true, stock: { $gt: 0, $lte: LOW_STOCK } }),
      Product.countDocuments({ isActive: true, stock: { $lte: 0 } }),
      Product.find({ isActive: true, stock: { $lte: LOW_STOCK } })
        .sort({ stock: 1 })
        .limit(6)
        .select("name stock images")
        .lean(),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: weekAgo } }),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: { $ne: "Cancelled" }, createdAt: { $gte: lastMonthStart } } },
        {
          $group: {
            _id: { $gte: ["$createdAt", monthStart] }, // true = this month
            total: { $sum: "$total" },
          },
        },
      ]),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("user", "firstName lastName")
        .select("orderNumber total status createdAt user")
        .lean(),
      User.countDocuments({ role: { $ne: "admin" } }),
      User.countDocuments({ role: { $ne: "admin" }, createdAt: { $gte: monthAgo } }),
      Consultation.countDocuments({ status: "Pending" }),
      CustomRequest.countDocuments({ status: { $in: ["Submitted", "In review"] } }),
      CustomRequest.countDocuments({ status: "Quoted" }),
      Consultation.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name space status createdAt")
        .lean(),
      CustomRequest.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("contactName piece status createdAt")
        .lean(),
      salesFor("week"),
      salesFor("month"),
    ]);

    const thisMonth = revenueRows.find((row) => row._id === true)?.total ?? 0;
    const lastMonth = revenueRows.find((row) => row._id === false)?.total ?? 0;

    const recentRequests = [
      ...recentConsultations.map((item) => ({
        id: item._id,
        type: "Consultation",
        name: item.name,
        subject: item.space,
        status: item.status,
        createdAt: item.createdAt,
      })),
      ...recentCustomRequests.map((item) => ({
        id: item._id,
        type: "Custom design",
        name: item.contactName,
        subject: item.piece,
        status: item.status,
        createdAt: item.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);

    res.json({
      products: { total: productTotal, lowStock, outOfStock },
      orders: {
        total: orderTotal,
        thisWeek: ordersThisWeek,
        byStatus: Object.fromEntries(statusRows.map((row) => [row._id, row.count])),
      },
      revenue: {
        thisMonth,
        lastMonth,
        change: lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null,
      },
      customers: { total: customerTotal, newThisMonth: newCustomers },
      requests: {
        pendingConsultations,
        openCustomRequests,
        quotedRequests,
        needsAction: pendingConsultations + openCustomRequests,
      },
      recentOrders,
      recentRequests,
      lowStockItems,
      weekly: { points: week.points, total: week.total },
      byCategory: month.byCategory,
    });
  } catch (error) {
    handleError(res, error);
  }
};