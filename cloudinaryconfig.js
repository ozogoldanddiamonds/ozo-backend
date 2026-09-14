const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: 'dhi7e8a6l',
  api_key: '337192569873694',
  api_secret: '1euG3rlJ7Le-M0bBeKWNoFcfMYw' // Click 'View API Keys' above to copy your API secret
});

module.exports = cloudinary;