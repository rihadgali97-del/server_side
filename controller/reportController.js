const Vendor = require('../models/Vendor');
const { generateVendorAuditPDF } = require('../utils/reports/vendorAuditReport');

exports.getVendorAuditReport = async (req, res) => {
  try {
    // 1. Fetch data
    const vendors = await Vendor.find().populate('user');
    
    // DEBUG: Look at your VS Code terminal for this log!
    console.log(`Building PDF for ${vendors.length} vendors...`);

    // 2. Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Vendor_Audit.pdf');

    // 3. Start the stream
    generateVendorAuditPDF(vendors, res);

  } catch (error) {
    console.error("PDF Streaming Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal Server Error during PDF build" });
    }
  }
};