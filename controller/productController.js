const productService = require("../services/productService");

exports.createProduct = async (req, res) => {
    try {
        const io = req.app.get('io');
        const filePath = req.file ? req.file.path : null;
        
        const product = await productService.createProduct(req.user.id, req.body, filePath, io);
        res.status(201).json(product);
    } catch (error) {
        res.status(error.message.includes("not found") ? 404 : 500).json({ message: error.message });
    }
};

exports.getProducts = async (req, res) => {
    try {
        const products = await productService.fetchProducts(req.query, req.user);
        res.json({ products });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const io = req.app.get('io');
        const product = await productService.updateProductData(req.params.id, req.body, io);
        res.json(product);
    } catch (error) {
        res.status(error.message === "Product not found" ? 404 : 500).json({ message: error.message });
    }
};

exports.getProduct = async (req, res) => {
    try {
        const product = await productService.fetchProductById(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await productService.removeProduct(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.searchProducts = async (req, res) => {
    try {
        const result = await productService.executeTrustSearch(req.query);
        res.json({
            success: true,
            count: result.products.length,
            pagination: { 
                page: result.page, 
                limit: result.limit, 
                total: result.total, 
                pages: Math.ceil(result.total / result.limit) 
            },
            data: result.products
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};