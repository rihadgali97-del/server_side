const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NextCart Multi-Vendor API',
      version: '1.0.0',
      description: 'Comprehensive API documentation for the NextCart e-commerce platform. Built by Rihad Gali.',
      contact: {
        name: 'Rihad Gali',
        email: 'yrihadgali97@gmail.com',
        url: 'https://github.com/rihadgali97-del',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // This tells Swagger where to look for documentation comments
  apis: ['./routes/*.js', './models/*.js'], 
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };