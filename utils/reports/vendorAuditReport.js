const PDFDocument = require('pdfkit');

exports.generateVendorAuditPDF = (vendors, res) => {
  // Create the document
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // 1. CRITICAL: Pipe the stream to the response immediately
  doc.pipe(res);

  // 2. Add Content
  doc.fontSize(25).fillColor('#2c3e50').text('NextCart Trust Audit', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('black').text(`Report Generated: ${new Date().toLocaleString()}`, { align: 'right' });
  doc.hr(); // Horizontal line
  doc.moveDown();

  if (!vendors || vendors.length === 0) {
    doc.fontSize(14).text("No vendor data found in the Trust Infrastructure Layer.", { align: 'center' });
  } else {
    vendors.forEach((v, i) => {
      doc.fontSize(12).fillColor('#2980b9').text(`${i + 1}. ${v.businessName || 'Unnamed Vendor'}`);
      doc.fontSize(10).fillColor('black').text(`Owner: ${v.user?.name || 'Unknown'}`);
      doc.text(`Status: ${v.status || 'Pending'}`);
      doc.moveDown(0.5);
    });
  }

  // 3. CRITICAL: Finalize the PDF file
  // This "flushes" the data through the pipe to the client
  doc.end();
};