const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: 'ivs9dcvf',
  api_key: '962215883736861',
  api_secret: '1euG3rlJ7Le-M0bBeKWNoFcfMYw' // Click 'View API Keys' above to copy your API secret
});

module.exports = cloudinary;