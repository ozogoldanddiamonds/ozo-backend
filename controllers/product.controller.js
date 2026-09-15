const Product = require("../models/product");

const cloudinary =
  require("../cloudinaryconfig");
const calculateVariantPrice =
  require("../utils/price-calculator");


/*
CREATE PRODUCT
*/
exports.createProduct = async (req, res) => {

  try {

    // =========================
    // REQUIRED VALIDATIONS
    // =========================

    if (!req.body.name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required"
      });
    }

    if (!req.body.category) {
      return res.status(400).json({
        success: false,
        message: "Category is required"
      });
    }

    if (!req.body.subCategory) {
      return res.status(400).json({
        success: false,
        message: "Sub Category is required"
      });
    }

    if (!req.body.productType) {
      return res.status(400).json({
        success: false,
        message: "Product type is required"
      });
    }

    if (!req.body.description?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Description is required"
      });
    }


    let imageUrls = [];
    let certificateUrl = "";
    let videoUrl = "";


    // =========================
    // PRODUCT IMAGES UPLOAD
    // =========================

    if (req.files?.images?.length > 0) {

      for (const file of req.files.images) {

        const result = await new Promise(
          (resolve, reject) => {

            cloudinary.uploader.upload_stream(
              {
                folder: "products"
              },
              (error, result) => {

                if (error) reject(error);
                else resolve(result);

              }
            ).end(file.buffer);

          }
        );

        imageUrls.push(result.secure_url);
      }
    }


    if (imageUrls.length === 0) {

      return res.status(400).json({
        success: false,
        message: "At least one product image is required"
      });

    }


    // =========================
    // CERTIFICATE UPLOAD
    // =========================

    if (req.files?.certificate?.length > 0) {

      const certFile =
        req.files.certificate[0];

      const certResult =
        await new Promise(
          (resolve, reject) => {

            cloudinary.uploader.upload_stream(
              {
                folder: "certificates",
                resource_type: "auto"
              },
              (error, result) => {

                if (error) reject(error);
                else resolve(result);

              }
            ).end(certFile.buffer);

          }
        );

      certificateUrl =
        certResult.secure_url;
    }


    // =========================
    // VIDEO UPLOAD
    // =========================

    if (req.files?.video?.length > 0) {

      const videoFile =
        req.files.video[0];

      const videoResult =
        await new Promise(
          (resolve, reject) => {

            cloudinary.uploader.upload_stream(
              {
                folder: "products/videos",
                resource_type: "video"
              },
              (error, result) => {

                if (error) reject(error);
                else resolve(result);

              }
            ).end(videoFile.buffer);

          }
        );

      videoUrl =
        videoResult.secure_url;
    }


    // =========================
    // PARSE VARIANTS
    // =========================

    let variants =
      req.body.variants
        ? JSON.parse(req.body.variants)
        : [];


    if (!variants.length) {

      return res.status(400).json({
        success: false,
        message: "At least one variant is required"
      });

    }


    // =====================================================
    // AUTO GENERATE SKU
    // FORMAT:
    // OZO + YYYYMMDD + 001
    // =====================================================

    const now = new Date();

    const year =
      now.getFullYear();

    const month =
      String(now.getMonth() + 1)
        .padStart(2, "0");

    const day =
      String(now.getDate())
        .padStart(2, "0");


    const datePrefix =
      `OZO${year}${month}${day}`;


    // =====================================================
    // FIND LAST SKU CREATED TODAY
    // =====================================================

    const lastProduct =
      await Product.findOne({
        "variants.sku": {
          $regex: `^${datePrefix}[0-9]{3}$`
        }
      })
        .sort({
          createdAt: -1
        })
        .lean();


    let nextNumber = 1;


    if (lastProduct?.variants?.length) {

      const todaySkus =
        lastProduct.variants
          .map(v => v.sku)
          .filter(sku =>
            sku &&
            sku.startsWith(datePrefix)
          );


      if (todaySkus.length) {

        const numbers =
          todaySkus.map(sku =>
            parseInt(
              sku.substring(datePrefix.length),
              10
            )
          );


        const maxNumber =
          Math.max(...numbers);


        nextNumber =
          maxNumber + 1;
      }
    }


    // =====================================================
    // GENERATE SKU FOR EVERY VARIANT
    // =====================================================

    variants =
      variants.map((variant) => {

        const skuNumber =
          String(nextNumber)
            .padStart(3, "0");


        const generatedSku =
          `${datePrefix}${skuNumber}`;


        nextNumber++;


        return {
          ...variant,
          sku: generatedSku
        };

      });


    // =====================================================
    // VALIDATE VARIANTS
    // =====================================================

    for (const variant of variants) {

      if (
        variant.stock === undefined ||
        variant.stock === null
      ) {

        return res.status(400).json({
          success: false,
          message:
            `Stock is required for SKU '${variant.sku}'`
        });

      }


      if (!variant.metalType) {

        return res.status(400).json({
          success: false,
          message:
            `Metal type is required for SKU '${variant.sku}'`
        });

      }


      if (!variant.metalPurity) {

        return res.status(400).json({
          success: false,
          message:
            `Metal purity is required for SKU '${variant.sku}'`
        });

      }


      if (!variant.grossWeight) {

        return res.status(400).json({
          success: false,
          message:
            `Gross weight is required for SKU '${variant.sku}'`
        });

      }


      if (!variant.netWeight) {

        return res.status(400).json({
          success: false,
          message:
            `Net weight is required for SKU '${variant.sku}'`
        });

      }

    }


    // =========================
    // PARSE TAGS
    // =========================

    const tags =
      req.body.tags
        ? JSON.parse(req.body.tags)
        : [];


    // =========================
    // PARSE META KEYWORDS
    // =========================

    const metaKeywords =
      req.body.metaKeywords
        ? JSON.parse(req.body.metaKeywords)
        : [];


    // =========================
    // UNIQUE VALIDATIONS
    // =========================

    // =========================
    // SLUG
    // =========================

    if (req.body.slug) {

      const existingSlug =
        await Product.findOne({
          slug: req.body.slug.trim()
        });

      if (existingSlug) {

        return res.status(409).json({
          success: false,
          message:
            `Slug '${req.body.slug}' already exists`
        });

      }

    }


    // =========================
    // HALLMARK
    // =========================

    if (req.body.hallmarkNumber) {

      const existingHallmark =
        await Product.findOne({
          hallmarkNumber:
            req.body.hallmarkNumber.trim()
        });

      if (existingHallmark) {

        return res.status(409).json({
          success: false,
          message:
            `Hallmark Number '${req.body.hallmarkNumber}' already exists`
        });

      }

    }


    // =========================
    // PRODUCT CREATE
    // =========================

    const product =
      await Product.create({

        name:
          req.body.name,

        slug:
          req.body.slug,

        shortDescription:
          req.body.shortDescription,

        description:
          req.body.description,

        category:
          req.body.category,

        subCategory:
          req.body.subCategory || null,

        subSubCategory:
          req.body.subSubCategory || null,

        productType:
          req.body.productType,

        gender:
          req.body.gender,

        occasion:
          req.body.occasion,

        brand:
          req.body.brand,

        hallmarkCertified:
          req.body.hallmarkCertified === "true",

        hallmarkNumber:
          req.body.hallmarkNumber,

        certificationIncluded:
          req.body.certificationIncluded === "true",

        certificateUrl,

        featured:
          req.body.featured === "true",

        bestSeller:
          req.body.bestSeller === "true",

        trending:
          req.body.trending === "true",

        newArrival:
          req.body.newArrival === "true",

        variants,

        images:
          imageUrls,

        video:
          videoUrl,

        tags,

        seoTitle:
          req.body.seoTitle,

        seoDescription:
          req.body.seoDescription,

        metaKeywords,

        isActive:
          req.body.isActive !== "false"

      });


    // =========================
    // SUCCESS RESPONSE
    // =========================

    res.status(201).json({

      success: true,

      message:
        "Product created successfully",

      data:
        product

    });


  } catch (error) {

    console.error(error);


    if (error.code === 11000) {

      const field =
        Object.keys(error.keyValue)[0];

      const value =
        error.keyValue[field];

      return res.status(409).json({

        success: false,

        message:
          `${field} '${value}' already exists`

      });

    }


    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};

exports.updateProduct = async (req, res) => {

  try {

    const { id } = req.params;

    // =========================
    // FIND PRODUCT
    // =========================

    const existingProduct =
      await Product.findById(id);

    if (!existingProduct) {

      return res.status(404).json({

        success: false,

        message:
          "Product not found"

      });

    }

    // =========================
    // EXISTING VALUES
    // =========================

    let imageUrls =
      existingProduct.images || [];

    let videoUrl =
      existingProduct.video || "";

    let certificateUrl =
      existingProduct.certificateUrl || "";

    // =========================
    // PRODUCT IMAGES UPLOAD
    // =========================

    if (req.files?.images?.length > 0) {

      imageUrls = [];

      for (const file of req.files.images) {

        const result =
          await new Promise(
            (resolve, reject) => {

              cloudinary.uploader.upload_stream(

                {
                  folder: "products"
                },

                (error, result) => {

                  if (error)
                    reject(error);

                  else
                    resolve(result);

                }

              ).end(file.buffer);

            }
          );

        imageUrls.push(
          result.secure_url
        );

      }

    }

    // =========================
    // VIDEO UPLOAD
    // =========================

    if (req.files?.video?.length > 0) {

      const videoFile =
        req.files.video[0];

      const videoResult =
        await new Promise(
          (resolve, reject) => {

            cloudinary.uploader.upload_stream(

              {
                folder: "products/videos",
                resource_type: "video"
              },

              (error, result) => {

                if (error)
                  reject(error);

                else
                  resolve(result);

              }

            ).end(videoFile.buffer);

          }
        );

      videoUrl =
        videoResult.secure_url;

    }

    // =========================
    // CERTIFICATE UPLOAD
    // =========================

    if (req.files?.certificate?.length > 0) {

      const certFile =
        req.files.certificate[0];

      const certResult =
        await new Promise(
          (resolve, reject) => {

            cloudinary.uploader.upload_stream(

              {
                folder: "certificates",
                resource_type: "auto"
              },

              (error, result) => {

                if (error)
                  reject(error);

                else
                  resolve(result);

              }

            ).end(certFile.buffer);

          }
        );

      certificateUrl =
        certResult.secure_url;

    }

    // =========================
    // PARSE VARIANTS
    // =========================

    const variants =
      req.body.variants
        ? JSON.parse(req.body.variants)
        : existingProduct.variants;

    // =========================
    // PARSE TAGS
    // =========================

    const tags =
      req.body.tags
        ? JSON.parse(req.body.tags)
        : existingProduct.tags;

    // =========================
    // PARSE META KEYWORDS
    // =========================

    const metaKeywords =
      req.body.metaKeywords
        ? JSON.parse(req.body.metaKeywords)
        : existingProduct.metaKeywords;

    // =========================
    // UPDATE PRODUCT
    // =========================

    const updatedProduct =
      await Product.findByIdAndUpdate(

        id,

        {

          name:
            req.body.name ??
            existingProduct.name,

          slug:
            req.body.slug ??
            existingProduct.slug,

          shortDescription:
            req.body.shortDescription ??
            existingProduct.shortDescription,

          description:
            req.body.description ??
            existingProduct.description,

          category:
            req.body.category ??
            existingProduct.category,

          subCategory:
            req.body.subCategory ??
            existingProduct.subCategory,

          subSubCategory:
            req.body.subSubCategory ??
            existingProduct.subSubCategory,

          productType:
            req.body.productType ??
            existingProduct.productType,

          gender:
            req.body.gender ??
            existingProduct.gender,

          occasion:
            req.body.occasion ??
            existingProduct.occasion,

          brand:
            req.body.brand ??
            existingProduct.brand,

          hallmarkCertified:
            req.body.hallmarkCertified !== undefined
              ? req.body.hallmarkCertified === "true"
              : existingProduct.hallmarkCertified,

          hallmarkNumber:
            req.body.hallmarkNumber ??
            existingProduct.hallmarkNumber,

          certificationIncluded:
            req.body.certificationIncluded !== undefined
              ? req.body.certificationIncluded === "true"
              : existingProduct.certificationIncluded,

          certificateUrl,

          featured:
            req.body.featured !== undefined
              ? req.body.featured === "true"
              : existingProduct.featured,

          bestSeller:
            req.body.bestSeller !== undefined
              ? req.body.bestSeller === "true"
              : existingProduct.bestSeller,

          trending:
            req.body.trending !== undefined
              ? req.body.trending === "true"
              : existingProduct.trending,

          newArrival:
            req.body.newArrival !== undefined
              ? req.body.newArrival === "true"
              : existingProduct.newArrival,

          variants,

          images:
            imageUrls,

          video:
            videoUrl,

          tags,

          seoTitle:
            req.body.seoTitle ??
            existingProduct.seoTitle,

          seoDescription:
            req.body.seoDescription ??
            existingProduct.seoDescription,

          metaKeywords,

          isActive:
            req.body.isActive !== undefined
              ? req.body.isActive === "true"
              : existingProduct.isActive

        },

        {
          new: true,
          runValidators: true
        }

      );

    res.status(200).json({

      success: true,

      message:
        "Product updated successfully",

      data:
        updatedProduct

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};

// exports.updateProduct = async (req, res) => {

//   try {

//     const {
//       id
//     } = req.params;

//     // =========================
//     // FIND PRODUCT
//     // =========================

//     const existingProduct =
//       await Product.findById(id);

//     if (!existingProduct) {

//       return res.status(404).json({

//         success: false,

//         message:
//           "Product not found"

//       });

//     }

//     // =========================
//     // IMAGE URLS
//     // =========================

//     let imageUrls =
//       existingProduct.images || [];

//     // =========================
//     // VIDEO URL
//     // =========================

//     let videoUrl =
//       existingProduct.video || "";

//     // =========================
//     // CERTIFICATE URL
//     // =========================

//     let certificateUrl = "";

//     // =====================================
//     // PRODUCT IMAGES UPLOAD
//     // =====================================

//     if (
//       req.files?.images?.length > 0
//     ) {

//       imageUrls = [];

//       for (const file of req.files.images) {

//         const result =
//           await new Promise(
//             (resolve, reject) => {

//               cloudinary.uploader.upload_stream(

//                 {
//                   folder: "products"
//                 },

//                 (error, result) => {

//                   if (error)
//                     reject(error);

//                   else
//                     resolve(result);

//                 }

//               ).end(file.buffer);

//             }
//           );

//         imageUrls.push(
//           result.secure_url
//         );

//       }

//     }

//     // =====================================
//     // VIDEO UPLOAD
//     // =====================================

//     if (
//       req.files?.video?.length > 0
//     ) {

//       const videoFile =
//         req.files.video[0];

//       const videoResult =
//         await new Promise(
//           (resolve, reject) => {

//             cloudinary.uploader.upload_stream(

//               {

//                 folder: "videos",

//                 resource_type: "auto"

//               },

//               (error, result) => {

//                 if (error)
//                   reject(error);

//                 else
//                   resolve(result);

//               }

//             ).end(videoFile.buffer);

//           }
//         );

//       videoUrl =
//         videoResult.secure_url;

//     }

//     // =====================================
//     // CERTIFICATE UPLOAD
//     // =====================================

//     if (
//       req.files?.certificate?.length > 0
//     ) {

//       const certFile =
//         req.files.certificate[0];

//       const certResult =
//         await new Promise(
//           (resolve, reject) => {

//             cloudinary.uploader.upload_stream(

//               {

//                 folder: "certificates",

//                 resource_type: "auto"

//               },

//               (error, result) => {

//                 if (error)
//                   reject(error);

//                 else
//                   resolve(result);

//               }

//             ).end(certFile.buffer);

//           }
//         );

//       certificateUrl =
//         certResult.secure_url;

//     }

//     // =====================================
//     // VARIANTS PARSE
//     // =====================================

//     let variants =
//       req.body.variants
//         ? JSON.parse(req.body.variants)
//         : existingProduct.variants;

//     // =====================================
//     // CERTIFICATE URL ADD
//     // =====================================

//     variants = variants.map(
//       (variant) => ({

//         ...variant,

//         diamonds:
//           variant.diamonds?.map(
//             (diamond) => ({

//               ...diamond,

//               certificateUrl:
//                 certificateUrl
//                 || diamond.certificateUrl
//                 || ""

//             })
//           ) || []

//       })
//     );

//     // =====================================
//     // UPDATE PRODUCT
//     // =====================================

//     const updatedProduct =
//       await Product.findByIdAndUpdate(

//         id,

//         {

//           ...req.body,

//           variants,

//           images:
//             imageUrls,

//           video:
//             videoUrl,

//           tags:
//             req.body.tags
//               ? JSON.parse(req.body.tags)
//               : existingProduct.tags

//         },

//         {

//           new: true

//         }

//       );

//     // =====================================
//     // RESPONSE
//     // =====================================

//     res.status(200).json({

//       success: true,

//       message:
//         "Product updated successfully",

//       data:
//         updatedProduct

//     });

//   } catch (error) {

//     console.log(error);

//     res.status(500).json({

//       success: false,

//       message:
//         error.message

//     });

//   }

// };


/*
GET ALL PRODUCTS
*/
// =====================================
// GET ALL PRODUCTS
// =====================================
exports.getAllProducts =
  async (req, res) => {

    try {

      const products =
        await Product.find()

          .populate("category")
          .populate("subCategory")
          .populate("subSubCategory")

          .sort({
            createdAt: -1
          })

          .lean();

      const updatedProducts =
        await Promise.all(

          products.map(async product => {

            const variants =
              await Promise.all(

                product.variants.map(
                  async variant => {

                    const priceDetails =
                      await calculateVariantPrice(
                        variant
                      );

                    return {
                      ...variant,
                      priceDetails
                    };
                  }
                )
              );

            return {
              ...product,
              variants
            };
          })
        );

      res.status(200).json({

        success: true,

        count:
          updatedProducts.length,

        data:
          updatedProducts

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  };

exports.getAllProductsWithPagination =
  async (req, res) => {

    try {

      // =========================
      // QUERY PARAMS
      // =========================

      const page =
        Number(req.query.page) || 1;

      const limit =
        Number(req.query.limit) || 10;

      const search =
        req.query.search || "";

      const skip =
        (page - 1) * limit;

      // =========================
      // SEARCH FILTER
      // =========================

      const searchFilter = {

        name: {
          $regex: search,
          $options: "i"
        }

      };

      // =========================
      // TOTAL COUNT
      // =========================

      const totalProducts =

        await Product.countDocuments(

          search
            ? searchFilter
            : {}

        );

      // =========================
      // GET PRODUCTS
      // =========================

      const products =

        await Product.find(

          search
            ? searchFilter
            : {}

        )

          .populate("category")

          .populate("subCategory")

          .populate("subSubCategory")

          .sort({
            createdAt: -1
          })

          .skip(skip)

          .limit(limit)

          .lean();

      // =========================
      // CALCULATE PRICES
      // =========================

      const updatedProducts =

        await Promise.all(

          products.map(
            async (product) => {

              const variants =

                await Promise.all(

                  product.variants.map(
                    async (variant) => {

                      const priceDetails =

                        await calculateVariantPrice(
                          variant
                        );

                      return {

                        ...variant,

                        calculatedPrice:
                          priceDetails.finalPrice,

                        priceBreakup:
                          priceDetails

                      };

                    }
                  )
                );

              return {

                ...product,

                variants

              };

            }
          )
        );

      // =========================
      // RESPONSE
      // =========================

      res.status(200).json({

        success: true,

        currentPage:
          page,

        totalPages:

          Math.ceil(
            totalProducts / limit
          ),

        totalProducts,

        count:
          updatedProducts.length,

        data:
          updatedProducts

      });

    } catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  };
// exports.getAllProductsWithPagination =
//   async (req, res) => {

//     try {

//       // =========================
//       // QUERY PARAMS
//       // =========================

//       const page =
//         Number(req.query.page) || 1;

//       const limit =
//         Number(req.query.limit) || 10;

//       const search =
//         req.query.search || "";

//       const skip =
//         (page - 1) * limit;

//       // =========================
//       // SEARCH FILTER
//       // =========================

//       const searchFilter = {

//         name: {
//           $regex: search,
//           $options: "i"
//         }

//       };

//       // =========================
//       // LATEST GOLD RATE
//       // =========================

//       const latestGoldRate =
//         await GoldRate.findOne()
//           .sort({
//             createdAt: -1
//           });

//       const ratePerGram =
//         latestGoldRate?.ratePerGram || 0;

//       // =========================
//       // TOTAL COUNT
//       // =========================

//       const totalProducts =

//         await Product.countDocuments(

//           search
//             ? searchFilter
//             : {}

//         );

//       // =========================
//       // GET PRODUCTS
//       // =========================

//       const products =

//         await Product.find(

//           search
//             ? searchFilter
//             : {}

//         )

//           .populate("category")

//           .populate("subCategory")

//           .populate("subSubCategory")

//           .sort({
//             createdAt: -1
//           })

//           .skip(skip)

//           .limit(limit);

//       // =========================
//       // USE HELPER
//       // =========================

//       const updatedProducts =

//         products.map(product =>

//           calculateProductPrices(
//             product,
//             ratePerGram
//           )

//         );

//       // =========================
//       // RESPONSE
//       // =========================

//       res.status(200).json({

//         success: true,

//         currentPage:
//           page,

//         totalPages:

//           Math.ceil(
//             totalProducts / limit
//           ),

//         totalProducts,

//         count:
//           updatedProducts.length,

//         data:
//           updatedProducts

//       });

//     } catch (error) {

//       console.log(error);

//       res.status(500).json({

//         success: false,

//         message:
//           error.message

//       });

//     }

//   };

/*
DELETE PRODUCT
*/
exports.deleteProduct =
  async (req, res) => {

    try {

      const product =
        await Product.findByIdAndDelete(
          req.params.id
        );

      if (!product) {

        return res.status(404)
          .json({

            success: false,

            message:
              "Product not found"

          });

      }

      res.status(200).json({

        success: true,

        message:
          "Product deleted successfully"

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  };

/*
GET PRODUCT BY ID
*/
// =====================================
// GET SINGLE PRODUCT BY ID
// =====================================
// exports.getProductById = async (
//   req,
//   res
// ) => {

//   try {

//     const { id } = req.params;

//     // =====================================
//     // FIND PRODUCT
//     // =====================================

//     const product =

//       await Product.findById(id)

//         .populate(
//           'category',
//           'name image'
//         )

//         .populate(
//           'subCategory',
//           'name image'
//         )

//         .populate(
//           'subSubCategory',
//           'name image'
//         );

//     // =====================================
//     // PRODUCT NOT FOUND
//     // =====================================

//     if (!product) {

//       return res.status(404).json({

//         success: false,

//         message:
//           'Product not found'

//       });

//     }

//     // =====================================
//     // LATEST GOLD RATE
//     // =====================================

//     const latestGoldRate =

//       await GoldRate.findOne()

//         .sort({
//           createdAt: -1
//         });

//     const ratePerGram =

//       latestGoldRate?.ratePerGram || 0;

//     // =====================================
//     // USE HELPER
//     // =====================================

//     const updatedProduct =

//       calculateProductPrices(

//         product,

//         ratePerGram

//       );

//     // =====================================
//     // RESPONSE
//     // =====================================

//     res.status(200).json({

//       success: true,

//       message:
//         'Product fetched successfully',

//       data:
//         updatedProduct

//     });

//   } catch (error) {

//     console.log(error);

//     res.status(500).json({

//       success: false,

//       message:
//         error.message

//     });

//   }

// };
exports.getProductById = async (
  req,
  res
) => {

  try {

    const { id } = req.params;

    // =====================================
    // FIND PRODUCT
    // =====================================

    const product =

      await Product.findById(id)

        .populate(
          "category",
          "name image"
        )

        .populate(
          "subCategory",
          "name image"
        )

        .populate(
          "subSubCategory",
          "name image"
        )

        .lean();

    // =====================================
    // PRODUCT NOT FOUND
    // =====================================

    if (!product) {

      return res.status(404).json({

        success: false,

        message:
          "Product not found"

      });

    }

    // =====================================
    // CALCULATE VARIANT PRICES
    // =====================================

    const variants =

      await Promise.all(

        product.variants.map(
          async (variant) => {

            const priceDetails =

              await calculateVariantPrice(
                variant
              );

            return {

              ...variant,
              stones:
                priceDetails.stones,

              calculatedPrice:
                priceDetails.finalPrice,

              priceBreakup:
                priceDetails

            };

          }
        )
      );

    const updatedProduct = {

      ...product,

      variants

    };

    // =====================================
    // RESPONSE
    // =====================================

    res.status(200).json({

      success: true,

      message:
        "Product fetched successfully",

      data:
        updatedProduct

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};

exports.getProductsByCategoryId = async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Validation
    if (!categoryId || !categoryId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category ID is required"
      });
    }

    // =====================================
    // VALIDATE ObjectId FORMAT
    // =====================================

    const isValidObjectId = categoryId.match(/^[0-9a-fA-F]{24}$/);
    if (!isValidObjectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid Category ID format"
      });
    }

    // =====================================
    // FIND PRODUCTS BY CATEGORY
    // =====================================

    console.log(`Searching for products with categoryId: ${categoryId}`);

    const products = await Product.find({
      category: categoryId  // MongoDB automatically converts string to ObjectId
    })
      .populate("category", "name image")
      .populate("subCategory", "name image")
      .populate("subSubCategory", "name image")
      .lean();

    console.log(`Found ${products.length} products for category ${categoryId}`);

    // =====================================
    // NO PRODUCTS FOUND
    // =====================================

    if (!products || products.length === 0) {
      // Debug: Check if category exists
      const categoryExists = await Product.findOne({ category: categoryId });
      console.log("Category exists in products?", categoryExists ? "Yes" : "No");

      return res.status(404).json({
        success: false,
        message: "No products found in this category",
        debug: {
          categoryId,
          productsCount: 0
        }
      });
    }

    // =====================================
    // CALCULATE VARIANT PRICES FOR ALL PRODUCTS
    // =====================================

    const productsWithPrices = await Promise.all(
      products.map(async (product) => {
        const variants = await Promise.all(
          product.variants.map(async (variant) => {
            const priceDetails = await calculateVariantPrice(variant);
            return {
              ...variant,
              stones: priceDetails.stones,
              calculatedPrice: priceDetails.finalPrice,
              priceBreakup: priceDetails
            };
          })
        );

        return {
          ...product,
          variants: variants
        };
      })
    );

    // =====================================
    // RESPONSE
    // =====================================

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: productsWithPrices,
      count: productsWithPrices.length
    });

  } catch (error) {
    console.log("Error in getProductsByCategoryId:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
exports.getProductsByType = async (
  req,
  res
) => {

  try {

    const type =
      req.params.type.toUpperCase();

    let filter = {
      isActive: true
    };

    // =========================
    // FILTERS
    // =========================

    if (type === "FEATURED") {

      filter.featured = true;

    }

    else if (type === "BESTSELLER") {

      filter.bestSeller = true;

    }

    else if (type === "TRENDING") {

      filter.trending = true;

    }

    else if (type === "NEW") {

      filter.newArrival = true;

    }

    else {

      return res.status(400).json({

        success: false,

        message:
          "Invalid Product Type"

      });

    }

    // =========================
    // GET PRODUCTS
    // =========================

    const products =

      await Product.find(filter)

        .populate("category")

        .populate("subCategory")

        .populate("subSubCategory")

        .sort({
          createdAt: -1
        })

        .lean();

    // =========================
    // CALCULATE VARIANT PRICES
    // =========================

    const updatedProducts =

      await Promise.all(

        products.map(async product => {

          const variants =

            await Promise.all(

              product.variants.map(
                async variant => {

                  const priceDetails =

                    await calculateVariantPrice(
                      variant
                    );

                  return {

                    ...variant,

                    priceDetails

                  };

                }
              )

            );

          return {

            ...product,

            variants

          };

        })

      );

    // =========================
    // RESPONSE
    // =========================

    res.status(200).json({

      success: true,

      count:
        updatedProducts.length,

      data:
        updatedProducts

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};

exports.getProductsByCategory = async (req, res) => {

  try {

    const {

      category,
      subCategory,
      productType,
      search = "",
      minPrice,
      maxPrice,
      sort = "latest",
      featured,
      trending,
      bestSeller,
      gender,
      page = 1,
      limit = 10

    } = req.query;

    const filter = {
      isActive: true
    };

    if (category)
      filter.category = category;

    if (subCategory)
      filter.subCategory = subCategory;

    if (
      productType &&
      productType !== "ALL"
    ) {
      filter.productType = productType;
    }

    if (featured === "true")
      filter.featured = true;

    if (trending === "true")
      filter.trending = true;

    if (bestSeller === "true")
      filter.bestSeller = true;

    if (gender)
      filter.gender = gender;

    if (search) {

      filter.name = {
        $regex: search,
        $options: "i"
      };

    }

    // =========================
    // FETCH PRODUCTS
    // =========================

    const products =

      await Product.find(filter)

        .populate(
          "category",
          "name image"
        )

        .populate(
          "subCategory",
          "name image"
        )

        .populate(
          "subSubCategory",
          "name image"
        )

        .sort({
          createdAt: -1
        })

        .lean();

    // =========================
    // CALCULATE VARIANT PRICES
    // =========================

    let updatedProducts =

      await Promise.all(

        products.map(
          async product => {

            const variants =

              await Promise.all(

                product.variants.map(
                  async variant => {

                    const priceDetails =
                      await calculateVariantPrice(
                        variant
                      );

                    return {
                      ...variant,
                      priceDetails
                    };

                  }
                )

              );

            return {
              ...product,
              variants
            };

          }
        )

      );

    // =========================
    // PRICE FILTER
    // =========================

    if (minPrice || maxPrice) {

      updatedProducts =

        updatedProducts.filter(
          product => {

            const lowestPrice =

              Math.min(

                ...product.variants.map(
                  v =>
                    v.priceDetails?.finalPrice || 0
                )

              );

            return (

              (!minPrice ||
                lowestPrice >= Number(minPrice))

              &&

              (!maxPrice ||
                lowestPrice <= Number(maxPrice))

            );

          }
        );

    }

    // =========================
    // SORTING
    // =========================

    if (sort === "lowToHigh") {

      updatedProducts.sort(
        (a, b) => {

          const aPrice =

            Math.min(
              ...a.variants.map(
                v =>
                  v.priceDetails?.finalPrice || 0
              )
            );

          const bPrice =

            Math.min(
              ...b.variants.map(
                v =>
                  v.priceDetails?.finalPrice || 0
              )
            );

          return aPrice - bPrice;

        }
      );

    }

    else if (
      sort === "highToLow"
    ) {

      updatedProducts.sort(
        (a, b) => {

          const aPrice =

            Math.min(
              ...a.variants.map(
                v =>
                  v.priceDetails?.finalPrice || 0
              )
            );

          const bPrice =

            Math.min(
              ...b.variants.map(
                v =>
                  v.priceDetails?.finalPrice || 0
              )
            );

          return bPrice - aPrice;

        }
      );

    }

    // =========================
    // PAGINATION
    // =========================

    const total =
      updatedProducts.length;

    const skip =
      (Number(page) - 1) *
      Number(limit);

    const paginatedProducts =

      updatedProducts.slice(
        skip,
        skip + Number(limit)
      );

    // =========================
    // RESPONSE
    // =========================

    res.status(200).json({

      success: true,

      total,

      currentPage:
        Number(page),

      totalPages:
        Math.ceil(
          total / Number(limit)
        ),

      count:
        paginatedProducts.length,

      data:
        paginatedProducts

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};

// =========================status
exports.changeProductStatus = async (req, res) => {
  try {

    const { id } = req.params;
    const { isActive } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    product.isActive = isActive;

    await product.save();

    return res.status(200).json({
      success: true,
      message: `Product ${isActive ? "Activated" : "Inactivated"} Successfully`,
      data: product
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

// exports.getProductsByType = async (
//   req,
//   res
// ) => {

//   try {

//     const type =
//       req.params.type.toUpperCase();

//     let filter = {
//       isActive: true
//     };

//     // =========================
//     // FILTERS
//     // =========================

//     if (type === "POPULAR") {

//       filter.popularCollection = true;

//     }

//     else if (type === "FEATURED") {

//       filter.featured = true;

//     }

//     else if (type === "BESTSELLER") {

//       filter.bestSeller = true;

//     }

//     else if (type === "TRENDING") {

//       filter.trending = true;

//     }

//     else if (type === "NEW") {

//       // no extra filter

//     }

//     else {

//       return res.status(400).json({

//         success: false,

//         message:
//           "Invalid Product Type"

//       });

//     }

//     // =========================
//     // LATEST GOLD RATE
//     // =========================

//     const latestGoldRate =

//       await GoldRate.findOne()

//         .sort({
//           createdAt: -1
//         });

//     const ratePerGram =

//       latestGoldRate?.ratePerGram || 0;

//     // =========================
//     // GET PRODUCTS
//     // =========================

//     const products =

//       await Product.find(filter)

//         .populate("category")

//         .populate("subCategory")

//         .populate("subSubCategory")

//         .sort({
//           createdAt: -1
//         });

//     // =========================
//     // USE HELPER
//     // =========================

//     const updatedProducts =

//       products.map(product =>

//         calculateProductPrices(

//           product,

//           ratePerGram

//         )

//       );

//     // =========================
//     // RESPONSE
//     // =========================

//     res.status(200).json({

//       success: true,

//       data:
//         updatedProducts

//     });

//   } catch (error) {

//     res.status(500).json({

//       success: false,

//       message:
//         error.message

//     });

//   }

// };

// exports.getProductsByCategory = async (req, res) => {

//   try {

//     const {

//       category,

//       subCategory,

//       productType,

//       search = '',

//       minPrice,

//       maxPrice,

//       sort = 'latest',

//       featured,

//       trending,

//       bestSeller,

//       gender,

//       page = 1,

//       limit = 10

//     } = req.query;

//     // =========================
//     // PAGINATION
//     // =========================

//     const skip =

//       (Number(page) - 1) *
//       Number(limit);

//     // =========================
//     // FILTER OBJECT
//     // =========================

//     const filter = {

//       isActive: true

//     };

//     // =========================
//     // CATEGORY
//     // =========================

//     if (category) {

//       filter.category = category;

//     }

//     // =========================
//     // SUB CATEGORY
//     // =========================

//     if (subCategory) {

//       filter.subCategory =
//         subCategory;

//     }

//     // =========================
//     // PRODUCT TYPE
//     // =========================

//     if (
//       productType &&
//       productType !== 'ALL'
//     ) {

//       filter.productType =
//         productType;

//     }

//     // =========================
//     // FEATURED
//     // =========================

//     if (featured === 'true') {

//       filter.featured = true;

//     }

//     // =========================
//     // TRENDING
//     // =========================

//     if (trending === 'true') {

//       filter.trending = true;

//     }

//     // =========================
//     // BESTSELLER
//     // =========================

//     if (bestSeller === 'true') {

//       filter.bestSeller = true;

//     }

//     // =========================
//     // GENDER
//     // =========================

//     if (gender) {

//       filter.gender = gender;

//     }

//     // =========================
//     // SEARCH
//     // =========================

//     if (search) {

//       filter.name = {

//         $regex: search,

//         $options: 'i'

//       };

//     }

//     // =========================
//     // LATEST GOLD RATE
//     // =========================

//     const latestGoldRate =

//       await GoldRate.findOne()

//         .sort({
//           createdAt: -1
//         });

//     const ratePerGram =

//       latestGoldRate?.ratePerGram || 0;

//     // =========================
//     // FETCH PRODUCTS
//     // =========================

//     let products =

//       await Product.find(filter)

//         .populate(
//           'category',
//           'name image'
//         )

//         .populate(
//           'subCategory',
//           'name image'
//         )

//         .populate(
//           'subSubCategory',
//           'name image'
//         )

//         .sort({

//           createdAt:

//             sort === 'latest'
//               ? -1
//               : 1

//         })

//         .skip(skip)

//         .limit(Number(limit));

//     // =========================
//     // APPLY HELPER
//     // =========================

//     let updatedProducts =

//       products.map(product =>

//         calculateProductPrices(

//           product,

//           ratePerGram

//         )

//       );

//     // =========================
//     // PRICE FILTER
//     // =========================

//     if (minPrice || maxPrice) {

//       updatedProducts =

//         updatedProducts.filter(
//           product => {

//             const firstVariant =

//               product.variants?.[0];

//             const price =

//               firstVariant?.finalPrice ||

//               0;

//             return (

//               (!minPrice ||

//                 price >= Number(minPrice))

//               &&

//               (!maxPrice ||

//                 price <= Number(maxPrice))

//             );

//           }
//         );

//     }

//     // =========================
//     // LOW TO HIGH
//     // =========================

//     if (sort === 'lowToHigh') {

//       updatedProducts.sort(
//         (a, b) =>

//           (a.variants?.[0]?.finalPrice || 0)

//           -

//           (b.variants?.[0]?.finalPrice || 0)
//       );

//     }

//     // =========================
//     // HIGH TO LOW
//     // =========================

//     if (sort === 'highToLow') {

//       updatedProducts.sort(
//         (a, b) =>

//           (b.variants?.[0]?.finalPrice || 0)

//           -

//           (a.variants?.[0]?.finalPrice || 0)
//       );

//     }

//     // =========================
//     // TOTAL
//     // =========================

//     const total =

//       await Product.countDocuments(
//         filter
//       );

//     // =========================
//     // RESPONSE
//     // =========================

//     res.status(200).json({

//       success: true,

//       total,

//       currentPage:
//         Number(page),

//       totalPages:
//         Math.ceil(total / limit),

//       data:
//         updatedProducts

//     });

//   } catch (error) {

//     res.status(500).json({

//       success: false,

//       message:
//         error.message

//     });

//   }

// };