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
      quantity
    } = req.body;

    const productData =
      await Product.findById(product);

    if (!productData) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const selectedVariant =
      productData.variants.id(variantId);

    if (!selectedVariant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found"
      });
    }

    let cart =
      await Cart.findOne({ user });

    if (!cart) {
      cart = new Cart({
        user,
        items: []
      });
    }

    cart.items.push({
      product,
      variantId,
      quantity
    });

    await cart.save();

    res.status(201).json({
      success: true,
      message: "Product added to cart successfully",
      data: cart
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};






/*
GET CART
*/
exports.getCart = async (req, res) => {

  try {

    // =========================
    // GET USER CART
    // =========================

    const cart = await Cart.findOne({
      user: req.params.userId
    }).populate("items.product");

    if (!cart) {

      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });

    }

    // =========================
    // REMOVE INVALID ITEMS
    // =========================

    const validCartEntries = [];

    for (const item of cart.items) {

      const product = item.product;

      if (!product) {
        continue;
      }

      const selectedVariant =
        product.variants?.id(item.variantId);

      if (!selectedVariant) {
        continue;
      }

      validCartEntries.push(item);

    }

    // =========================
    // AUTO CLEANUP CART
    // =========================

    if (
      validCartEntries.length !==
      cart.items.length
    ) {

      cart.items = validCartEntries;

      await cart.save();

    }

    // =========================
    // PREPARE CART ITEMS
    // =========================

    const cartItems = await Promise.all(

      validCartEntries.map(
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

          const totalPrice =
            priceDetails.finalPrice *
            item.quantity;

          return {

            cartItemId:
              item._id,

            productId:
              product._id,

            productName:
              product.name,

            image:
              product.images?.[0] || "",

            selectedVariant: {

              ...selectedVariant.toObject(),

              priceBreakup:
                priceDetails,

              finalPrice:
                priceDetails.finalPrice

            },

            quantity:
              item.quantity,

            totalPrice:
              Number(
                totalPrice.toFixed(2)
              )

          };

        }

      )

    );

    // =========================
    // CART TOTAL
    // =========================

    const cartTotal = cartItems.reduce(

      (sum, item) =>

        sum + item.totalPrice,

      0

    );

    // =========================
    // RESPONSE
    // =========================

    return res.status(200).json({

      success: true,

      message:
        "Cart fetched successfully",

      cartId:
        cart._id,

      items:
        cartItems,

      cartCount:
        cartItems.length,

      cartTotal:
        Number(
          cartTotal.toFixed(2)
        )

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

/*
UPDATE CART ITEM
*/
exports.updateCartItem = async (req, res) => {
  try {
    console.log("BODY:", req.body);

    const { quantity } =
      req.body || {};

    if (quantity === undefined) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity is required"
      });
    }

    const cart =
      await Cart.findById(
        req.params.cartId
      );

    if (!cart) {
      return res.status(404).json({
        success: false,
        message:
          "Cart not found"
      });
    }

    const item =
      cart.items.id(
        req.params.itemId
      );

    if (!item) {
      return res.status(404).json({
        success: false,
        message:
          "Cart item not found"
      });
    }

    item.quantity =
      Number(quantity);

    await cart.save();

    res.status(200).json({
      success: true,
      message:
        "Cart updated successfully",
      data: cart
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