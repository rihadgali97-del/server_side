const Coupon = require("../models/Coupon");
const Vendor = require("../models/Vendor");

// ─── Shared helper ─────────────────────────────────────────────────────────────
const pickFields = (body) => ({
  code:           body.code?.toUpperCase().trim(),
  discountType:   body.discountType,
  value:          Number(body.value),
  minOrderAmount: Number(body.minOrderAmount || 0),
  maxDiscount:    body.maxDiscount ? Number(body.maxDiscount) : null,
  maxUses:        body.maxUses     ? Number(body.maxUses)     : null,
  expiryDate:     body.expiryDate  ? new Date(body.expiryDate): null,
  isActive:       body.isActive !== undefined ? body.isActive : true,
  description:    body.description || "",
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC — validate & apply coupon at checkout
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/coupons/validate
// Body: { code, orderAmount, vendorId? }
exports.validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount, vendorId } = req.body;
    if (!code || !orderAmount)
      return res.status(400).json({ success:false, message:"code and orderAmount are required" });

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon)
      return res.status(404).json({ success:false, message:"Coupon not found" });

    // If vendor coupon — must match the vendor in cart
    if (coupon.vendor && vendorId && coupon.vendor.toString() !== vendorId.toString())
      return res.status(400).json({ success:false, message:"This coupon is not valid for this vendor" });

    const check = coupon.validate(req.user._id, Number(orderAmount));
    if (!check.valid)
      return res.status(400).json({ success:false, message: check.message });

    const discount    = coupon.calcDiscount(Number(orderAmount));
    const finalAmount = Math.max(0, Number(orderAmount) - discount);

    res.json({
      success: true,
      coupon: {
        code:         coupon.code,
        discountType: coupon.discountType,
        value:        coupon.value,
        description:  coupon.description,
      },
      discount:    +discount.toFixed(2),
      finalAmount: +finalAmount.toFixed(2),
    });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — full CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/coupons
exports.adminGetCoupons = async (req, res) => {
  try {
    const { page=1, limit=20, search, isActive } = req.query;
    const query = {};
    if (search)   query.code = { $regex: search.toUpperCase(), $options:"i" };
    if (isActive !== undefined) query.isActive = isActive === "true";

    const [coupons, total] = await Promise.all([
      Coupon.find(query)
        .populate("vendor", "businessName")
        .populate("createdBy", "name email")
        .sort({ createdAt:-1 })
        .skip((page-1)*limit).limit(Number(limit)),
      Coupon.countDocuments(query),
    ]);
    res.json({ success:true, data:coupons,
      pagination:{ page:Number(page), limit:Number(limit), total, pages:Math.ceil(total/limit) } });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
};

// POST /api/admin/coupons
exports.adminCreateCoupon = async (req, res) => {
  try {
    const fields = pickFields(req.body);
    if (!fields.code)         return res.status(400).json({ success:false, message:"Code is required" });
    if (!fields.discountType) return res.status(400).json({ success:false, message:"Discount type is required" });
    if (!fields.value)        return res.status(400).json({ success:false, message:"Value is required" });
    if (fields.discountType === "percentage" && fields.value > 100)
      return res.status(400).json({ success:false, message:"Percentage cannot exceed 100" });

    const coupon = await Coupon.create({
      ...fields,
      createdBy:     req.user._id,
      createdByRole: "admin",
    });
    res.status(201).json({ success:true, data:coupon });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success:false, message:"Coupon code already exists" });
    res.status(500).json({ success:false, message:err.message });
  }
};

// PUT /api/admin/coupons/:id
exports.adminUpdateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id, { $set: pickFields(req.body) }, { new:true, runValidators:true }
    );
    if (!coupon) return res.status(404).json({ success:false, message:"Coupon not found" });
    res.json({ success:true, data:coupon });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
};

// DELETE /api/admin/coupons/:id
exports.adminDeleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ success:false, message:"Coupon not found" });
    res.json({ success:true, message:"Coupon deleted" });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR — manage own coupons
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/vendors/coupons
exports.vendorGetCoupons = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success:false, message:"Vendor not found" });

    const coupons = await Coupon.find({ vendor: vendor._id }).sort({ createdAt:-1 });
    res.json({ success:true, data:coupons });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
};

// POST /api/vendors/coupons
exports.vendorCreateCoupon = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success:false, message:"Vendor not found" });

    const fields = pickFields(req.body);
    if (!fields.code)         return res.status(400).json({ success:false, message:"Code is required" });
    if (!fields.discountType) return res.status(400).json({ success:false, message:"Discount type is required" });
    if (!fields.value)        return res.status(400).json({ success:false, message:"Value is required" });
    if (fields.discountType === "percentage" && fields.value > 100)
      return res.status(400).json({ success:false, message:"Percentage cannot exceed 100" });

    const coupon = await Coupon.create({
      ...fields,
      vendor:        vendor._id,
      createdBy:     req.user._id,
      createdByRole: "vendor",
    });
    res.status(201).json({ success:true, data:coupon });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success:false, message:"Coupon code already exists" });
    res.status(500).json({ success:false, message:err.message });
  }
};

// PUT /api/vendors/coupons/:id
exports.vendorUpdateCoupon = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success:false, message:"Vendor not found" });

    // Vendor can only update their own coupons
    const coupon = await Coupon.findOneAndUpdate(
      { _id: req.params.id, vendor: vendor._id },
      { $set: pickFields(req.body) },
      { new:true, runValidators:true }
    );
    if (!coupon) return res.status(404).json({ success:false, message:"Coupon not found" });
    res.json({ success:true, data:coupon });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
};

// DELETE /api/vendors/coupons/:id
exports.vendorDeleteCoupon = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success:false, message:"Vendor not found" });

    const coupon = await Coupon.findOneAndDelete({ _id:req.params.id, vendor:vendor._id });
    if (!coupon) return res.status(404).json({ success:false, message:"Coupon not found" });
    res.json({ success:true, message:"Coupon deleted" });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
};