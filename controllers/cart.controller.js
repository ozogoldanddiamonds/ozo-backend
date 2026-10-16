const Cart = require("../models/cart");
const Product = require("../models/product");
const calculateVariantPrice = require("../utils/price-calculator");



/*
ADD TO CART
*/

exports.addToCart = async (req, res) => {
  try {
    const {
      user,
      product,
      variantId,
      quantity = 1
    } = req.body;

    const requestedQuantity = Number(quantity);

    if (
      !Number.isInteger(requestedQuantity) ||
      requestedQuantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid quantity."
      });
    }

    // Find product
    const productData = await Product.findById(product);

    if (!productData) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    // Find selected variant
    const selectedVariant = productData.variants.id(variantId);

    if (!selectedVariant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found."
      });
    }

    // Validate stock
    const stock = Number(selectedVariant.stock || 0);

    if (stock <= 0) {
      return res.status(400).json({
        success: false,
        message: "This product is currently out of stock.",
        stock
      });
    }

    // Find or create user's cart
    let cart = await Cart.findOne({ user });

    if (!cart) {
      cart = new Cart({
        user,
        items: []
      });
    }

    // Find the same product + same variant
    const existingItem = cart.items.find(item =>
      item.product.toString() === product.toString() &&
      item.variantId.toString() === variantId.toString()
    );

    if (existingItem) {
      // Increase existing quantity instead of adding a duplicate
      const updatedQuantity =
        Number(existingItem.quantity) + requestedQuantity;

      if (updatedQuantity > stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${stock} item(s) available in stock. You already have ${existingItem.quantity} in your cart.`,
          stock,
          cartQuantity: existingItem.quantity
        });
      }

      existingItem.quantity = updatedQuantity;

    } else {
      // Add a new item only if this variant is not already in cart
      if (requestedQuantity > stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${stock} item(s) available in stock.`,
          stock
        });
      }

      cart.items.push({
        product,
        variantId,
        quantity: requestedQuantity
      });
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: existingItem
        ? "Cart quantity updated successfully."
        : "Product added to cart successfully.",
      data: cart
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// exports.addToCart = async (req, res) => {
//   try {
//     const {
//       user,
//       product,
//       variantId,
//       quantity
//     } = req.body;

//     const productData =
//       await Product.findById(product);

//     if (!productData) {
//       return res.status(404).json({
//         success: false,
//         message: "Product not found"
//       });
//     }

//     const selectedVariant =
//       productData.variants.id(variantId);

//     if (!selectedVariant) {
//       return res.status(404).json({
//         success: false,
//         message: "Variant not found"
//       });
//     }

//     let cart =
//       await Cart.findOne({ user });

//     if (!cart) {
//       cart = new Cart({
//         user,
//         items: []
//       });
//     }

//     cart.items.push({
//       product,
//       variantId,
//       quantity
//     });

//     await cart.save();

//     res.status(201).json({
//       success: true,
//       message: "Product added to cart successfully",
//       data: cart
//     });

//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };






/*
GET CART
*/

exports.getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const cart = await Cart.findOne({
      user: userId
    }).populate("items.product");

    // Return an empty cart instead of treating it as an API error
    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart fetched successfully",
        cartId: null,
        items: [],
        cartCount: 0,
        totalQuantity: 0,
        cartTotal: 0
      });
    }

    // Remove entries with missing products or variants
    const validCartEntries = [];

    for (const item of cart.items) {
      const product = item.product;

      if (!product) {
        continue;
      }

      const selectedVariant = product.variants?.id(item.variantId);

      if (!selectedVariant) {
        continue;
      }

      validCartEntries.push(item);
    }

    // Save cleanup only when invalid entries exist
    if (validCartEntries.length !== cart.items.length) {
      cart.items = validCartEntries;
      await cart.save();
    }

    // Prepare cart items with current prices and stock
    const cartItems = await Promise.all(
      validCartEntries.map(async (item) => {
        const product = item.product;

        const selectedVariant = product.variants.id(
          item.variantId
        );

        const priceDetails = await calculateVariantPrice(
          selectedVariant
        );

        const quantity = Math.max(
          1,
          Number(item.quantity) || 1
        );

        const finalPrice = Number(
          Number(priceDetails.finalPrice || 0).toFixed(2)
        );

        const totalPrice = Number(
          (finalPrice * quantity).toFixed(2)
        );

        return {
          cartItemId: item._id,
          productId: product._id,
          productName: product.name,
          image: product.images?.[0] || "",

          selectedVariant: {
            ...selectedVariant.toObject(),
            priceBreakup: priceDetails,
            finalPrice,
            stock: Number(selectedVariant.stock || 0)
          },

          quantity,
          totalPrice
        };
      })
    );

    // Calculate totals
    const cartTotal = Number(
      cartItems
        .reduce((sum, item) => sum + item.totalPrice, 0)
        .toFixed(2)
    );

    // Total quantity across all cart entries
    const totalQuantity = cartItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    return res.status(200).json({
      success: true,
      message: "Cart fetched successfully",
      cartId: cart._id,
      items: cartItems,

      // Number of distinct cart entries
      cartCount: cartItems.length,

      // Total units across all entries
      totalQuantity,

      cartTotal
    });

  } catch (error) {
    console.error("Get cart error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
      error: error.message
    });
  }
};

// exports.getCart = async (req, res) => {

//   try {

//     // =========================
//     // GET USER CART
//     // =========================

//     const cart = await Cart.findOne({
//       user: req.params.userId
//     }).populate("items.product");

//     if (!cart) {

//       return res.status(404).json({
//         success: false,
//         message: "Cart not found"
//       });

//     }

//     // =========================
//     // REMOVE INVALID ITEMS
//     // =========================

//     const validCartEntries = [];

//     for (const item of cart.items) {

//       const product = item.product;

//       if (!product) {
//         continue;
//       }

//       const selectedVariant =
//         product.variants?.id(item.variantId);

//       if (!selectedVariant) {
//         continue;
//       }

//       validCartEntries.push(item);

//     }

//     // =========================
//     // AUTO CLEANUP CART
//     // =========================

//     if (
//       validCartEntries.length !==
//       cart.items.length
//     ) {

//       cart.items = validCartEntries;

//       await cart.save();

//     }

//     // =========================
//     // PREPARE CART ITEMS
//     // =========================

//     const cartItems = await Promise.all(

//       validCartEntries.map(
//         async (item) => {

//           const product =
//             item.product;

//           const selectedVariant =
//             product.variants.id(
//               item.variantId
//             );

//           const priceDetails =
//             await calculateVariantPrice(
//               selectedVariant
//             );

//           const totalPrice =
//             priceDetails.finalPrice *
//             item.quantity;

//           return {

//             cartItemId:
//               item._id,

//             productId:
//               product._id,

//             productName:
//               product.name,

//             image:
//               product.images?.[0] || "",

//             selectedVariant: {

//               ...selectedVariant.toObject(),

//               priceBreakup:
//                 priceDetails,

//               finalPrice:
//                 priceDetails.finalPrice

//             },

//             quantity:
//               item.quantity,

//             totalPrice:
//               Number(
//                 totalPrice.toFixed(2)
//               )

//           };

//         }

//       )

//     );

//     // =========================
//     // CART TOTAL
//     // =========================

//     const cartTotal = cartItems.reduce(

//       (sum, item) =>

//         sum + item.totalPrice,

//       0

//     );

//     // =========================
//     // RESPONSE
//     // =========================

//     return res.status(200).json({

//       success: true,

//       message:
//         "Cart fetched successfully",

//       cartId:
//         cart._id,

//       items:
//         cartItems,

//       cartCount:
//         cartItems.length,

//       cartTotal:
//         Number(
//           cartTotal.toFixed(2)
//         )

//     });

//   } catch (error) {

//     console.log(error);

//     return res.status(500).json({

//       success: false,

//       message:
//         error.message

//     });

//   }

// };

/*
UPDATE CART ITEM
*/

exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body || {};
    const requestedQuantity = Number(quantity);

    if (
      !Number.isInteger(requestedQuantity) ||
      requestedQuantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer"
      });
    }

    const cart = await Cart.findById(req.params.cartId);

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    const item = cart.items.id(req.params.itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }

    const product = await Product.findById(item.product);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const variant = product.variants.id(item.variantId);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found"
      });
    }

    const stock = Number(variant.stock) || 0;

    if (stock <= 0) {
      return res.status(400).json({
        success: false,
        message: "Out of stock"
      });
    }

    if (requestedQuantity > stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${stock} item(s) available in stock`
      });
    }

    item.quantity = requestedQuantity;

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      data: cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



/*
REMOVE CART ITEM
*/
exports.removeCartItem = async (
  req,
  res
) => {

  try {

    const {

      cartId,

      itemId

    } = req.params;

    // =========================
    // FIND CART
    // =========================

    const cart =

      await Cart.findById(
        cartId
      );

    // =========================
    // CART NOT FOUND
    // =========================

    if (!cart) {

      return res.status(404).json({

        success: false,

        message:
          'Cart not found'

      });

    }

    // =========================
    // REMOVE ITEM
    // =========================

    cart.items =

      cart.items.filter(

        item =>

          item._id.toString()

          !==

          itemId

      );

    // =========================
    // SAVE CART
    // =========================

    await cart.save();

    // =========================
    // RESPONSE
    // =========================

    res.status(200).json({

      success: true,

      message:
        'Cart item removed successfully',

      cartCount:
        cart.items.length,

      data:
        cart

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



/*
CLEAR CART
*/
exports.clearCart = async (req, res) => {
  try {
    const cart =
      await Cart.findOne({
        user: req.params.userId
      });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    cart.items = [];

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateCartQuantity = async (req, res) => {

  try {

    const {
      cartId,
      itemId
    } = req.params;

    const {
      quantity
    } = req.body;

    const cart =
      await Cart.findById(cartId);

    if (!cart) {

      return res.status(404).json({

        success: false,

        message: "Cart not found"

      });

    }

    const item =
      cart.items.id(itemId);

    if (!item) {

      return res.status(404).json({

        success: false,

        message: "Item not found"

      });

    }

    item.quantity = quantity;

    await cart.save();

    res.status(200).json({

      success: true,

      message:
        "Quantity updated"

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};