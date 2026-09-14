const Wishlist =
  require("../models/wishlist");

const Product =
  require("../models/product");
const calculateVariantPrice =
  require("../utils/price-calculator");


/*
ADD TO WISHLIST
*/
exports.addToWishlist =
  async (req, res) => {
    try {
      const {
        user,
        product,
        variantId
      } = req.body;

      if (!user || !product) {
        return res.status(400).json({
          success: false,
          message:
            "User and Product are required"
        });
      }

      const productExists =
        await Product.findById(
          product
        );

      if (!productExists) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found"
        });
      }

      let wishlist =
        await Wishlist.findOne({
          user
        });

      if (!wishlist) {
        wishlist =
          new Wishlist({
            user,
            items: []
          });
      }

      const alreadyExists =
        wishlist.items.find(
          (item) =>
            item.product.toString() ===
            product &&
            item.variantId?.toString() ===
            variantId
        );

      if (alreadyExists) {
        return res.status(400).json({
          success: false,
          message:
            "Product already in wishlist"
        });
      }

      wishlist.items.push({
        product,
        variantId
      });

      await wishlist.save();

      res.status(201).json({
        success: true,
        message:
          "Added to wishlist successfully",
        data: wishlist
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
GET WISHLIST
*/
exports.getWishlist = async (
  req,
  res
) => {

  try {

    const wishlist =

      await Wishlist.findOne({

        user:
          req.params.userId

      })

        .populate("items.product");

    if (!wishlist) {

      return res.status(404).json({

        success: false,

        message:
          "Wishlist not found"

      });

    }

    // =========================
    // REMOVE INVALID ITEMS
    // =========================

    const validWishlistEntries = [];

    for (const item of wishlist.items) {

      const product =
        item.product;

      if (!product) {
        continue;
      }

      const selectedVariant =

        product.variants?.id(
          item.variantId
        );

      if (!selectedVariant) {
        continue;
      }

      validWishlistEntries.push(item);

    }

    // =========================
    // AUTO CLEANUP
    // =========================

    if (

      validWishlistEntries.length !==
      wishlist.items.length

    ) {

      wishlist.items =
        validWishlistEntries;

      await wishlist.save();

    }

    // =========================
    // PREPARE ITEMS
    // =========================

    const wishlistItems =

      await Promise.all(

        validWishlistEntries.map(
          async (item) => {

            const product =
              item.product;

            const selectedVariant =

              product.variants.id(
                item.variantId
              );

            const priceDetails =

              await calculateVariantPrice(
                selectedVariant
              );

            return {

              wishlistItemId:
                item._id.toString(),

              productId:
                product._id.toString(),

              variantId:
                selectedVariant._id.toString(),

              productName:
                product.name,

              image:
                product.images?.[0] || "",

              variants:
                product.variants || [],

              selectedVariant: {

                ...selectedVariant.toObject(),

                _id:
                  selectedVariant._id.toString(),

                priceBreakup:
                  priceDetails,

                finalPrice:
                  priceDetails.finalPrice

              }

            };

          }

        )

      );

    // =========================
    // RESPONSE
    // =========================

    return res.status(200).json({

      success: true,

      message:
        "Wishlist fetched successfully",

      wishlistId:
        wishlist._id.toString(),

      wishlistCount:
        wishlistItems.length,

      items:
        wishlistItems

    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};
exports.removeWishlistItem =
  async (req, res) => {
    try {
      const wishlist =
        await Wishlist.findById(
          req.params.wishlistId
        );

      if (!wishlist) {
        return res.status(404).json({
          success: false,
          message:
            "Wishlist not found"
        });
      }

      const item =
        wishlist.items.id(
          req.params.itemId
        );

      if (!item) {
        return res.status(404).json({
          success: false,
          message:
            "Wishlist item not found"
        });
      }

      wishlist.items =
        wishlist.items.filter(
          (item) =>
            item._id.toString() !==
            req.params.itemId
        );

      await wishlist.save();

      res.status(200).json({
        success: true,
        message:
          "Wishlist item removed successfully"
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  };