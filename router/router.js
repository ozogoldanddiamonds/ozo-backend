const express = require("express");
const router = express.Router();

// router.post("/upload", upload.single("image"), uploadImage);




const { register, login, forgotPassword, resetPassword, getAllSubBranches, updateSubBranch, getSubBranchById, deleteSubBranch, getBranchList, updateSubBranchStatus } = require('../controllers/user.controller');
const { createGoldRate, getAllGoldRates, getGoldRateById, updateGoldRate, deleteGoldRate } = require("../controllers/goldrate.controller");
const { createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory } = require("../controllers/category.controller");
const { getSubCategoryByCategory, createSubCategory, getAllSubCategories, getSubCategoryById, updateSubCategory, deleteSubCategory } = require("../controllers/subcategory.controller");
const { getSubSubCategoryBySubCategory, createSubSubCategory, getAllSubSubCategories, getSubSubCategoryById, updateSubSubCategory, deleteSubSubCategory } = require("../controllers/subsubcategory.controller");
const { createProduct, getAllProducts, getAllProductsWithPagination, getProductsByType, getProductById, updateProduct, deleteProduct, getProductsByCategory, getProductsByCategoryId, changeProductStatus } = require("../controllers/product.controller");
const { getAllUsers, getUsersCount, getProfileSummary, userLogout, Userregister, userLogin, userforgotPassword, verifyOTP, resendOTP, userresetPassword } = require("../controllers/userlogin.controller");
const { addToCart, getCart, updateCartItem, removeCartItem, clearCart } = require("../controllers/cart.controller");
const { addToWishlist, getWishlist, removeWishlistItem } = require("../controllers/wishlist.controller");
const { createAddress, getAddresses, getAddressById, updateAddress, deleteAddress, getAllAddresses, setDefaultAddress } = require("../controllers/address.controller");
const { createBanner, updateBanner, getAllBanners, deleteBanner } = require("../controllers/banner.controller");
const { createContact, getAllContacts, getContactById, updateContact, deleteContact } = require("../controllers/contact.controller");
const { createCoupon, getAllCoupons, getCouponById, updateCoupon, deleteCoupon } = require("../controllers/coupon.controller");
const { createReview, getAllReviews, getReviewById, getProductReviews, updateReview, deleteReview } = require("../controllers/review.controller");
const { createMetalRate, getAllMetalRates, getMetalRateById, updateMetalRate, deleteMetalRate, toggleMetalRateStatus } = require("../controllers/metal-rate.controller");
const { createStoneRate, getAllStoneRates, getStoneRateById, updateStoneRate, deleteStoneRate, toggleStoneRateStatus } = require("../controllers/stone-rate.controller");
const { calculatePrice, deleteOrder, createOrder, getAllOrders, getOrderById, getOrdersByUser, getBranchOrders, getSubBranchOrders } = require("../controllers/order.controller");

const { createSizeChart, getAllSizeCharts, getSizeChartBySubCategory, updateSizeChart, deleteSizeChart } = require("../controllers/size-chart.controller");
const { createAds, getAllAds, getAdsById, updateSection, deleteAds, updateAdsStatus } = require("../controllers/adss.controller");
const { createEmployee, getAllEmployees, getEmployeeById, updateEmployee, updateEmployeeStatus, deleteEmployee, getEmployeesByBranch } = require('../controllers/employee.controller');
const { assignProductToSubBranch, getAssignedProducts, returnAssignedProduct, assignMultipleProducts, getAssignedProductsBySubBranch } = require("../controllers/assignProduct-subbranch");
const { createScheme, getAllSchemes, getSchemeById, updateScheme, deleteScheme, updateSchemeStatus } = require("../controllers/scheme.controller");
const { createUserScheme, getAllUserSchemes, getUserSchemeByUserId, updateUserScheme, deleteUserScheme, getUserSchemeById } = require("../controllers/userscheme.controller");
const { createPayment, getAllPayments, getPaymentById, updatePayment, deletePayment, getUserPayments, getPaymentHistory } = require("../controllers/schema-payment.controller");

// const router = express.Router();


const upload = require("../middleware/upload");
const { verifyToken } = require("../middleware/auth");

const { uploadCertificate } = require("../controllers/upload.controller");
const { createSupplier, getAllSuppliers, getActiveSuppliers, getSupplierById, updateSupplier, deleteSupplier, updateSupplierStatus } = require("../controllers/supplier.controller");
const { createSupplierPurchase, getAllSupplierPurchases, getSupplierPurchaseById, getSupplierPurchases, updateSupplierPurchase, addPurchaseDocument, deletePurchaseDocument, updatePurchasePaymentStatus, updateSupplierPurchaseStatus, deleteSupplierPurchase } = require("../controllers/supplier-purchase.controller")
const { createSupplierPurchaseItem, getAllSupplierPurchaseItems, getPurchaseItemsByPurchase, getPurchaseItemsByProduct, getPurchaseItemsByVariant, updateSupplierPurchaseItem, deleteSupplierPurchaseItem } = require("../controllers/supplier-purchase-items.controller");
const { createMaker, getAllMakers, getActiveMakers, getMakerById, updateMaker, deleteMaker, updateMakerStatus } = require("../controllers/maker.controller");
const { createMakerProduction, getAllMakerProductions, getMakerProductionById, getMakerProductionsByMaker, updateMakerProduction, updateMakerProductionStatus, deleteMakerProduction } = require("../controllers/maker-production.controller");
const { createMakerProductionItem, getAllMakerProductionItems, getProductionItems, getProductProductionItems, getVariantProductionItems, getMakerProductionItemById, updateMakerProductionItem, deleteMakerProductionItem } = require("../controllers/maker-production-item.controller");


router.post("/create-contact", createContact);
router.get("/getall-contact", getAllContacts);
router.post("/getbyid-contact/:id", getContactById);
router.put("/update-contact/:id", updateContact);
router.delete("/delete-contact/:id", deleteContact);



router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/get-all-subbranches', getAllSubBranches);
router.put('/update-subbranch/:id', updateSubBranch);
router.put("/update-subbranch-status/:id", updateSubBranchStatus);
router.get('/getSubBranchById/:id', getSubBranchById);
router.delete('/delete-subbranch/:id', deleteSubBranch);
router.get('/get-branch-list', getBranchList);


// gold Rate

router.post("/gold-rate", createGoldRate);
router.get("/gold-rate", getAllGoldRates);
router.get("/gold-rate/:id", getGoldRateById);
router.put("/gold-rate/:id", updateGoldRate);
router.delete("/gold-rate/:id", deleteGoldRate);

router.post('/create-category', upload.single('image'), createCategory);
router.get("/getallcategory", getAllCategories);
router.get("/getbyIdcategory/:id", getCategoryById);
router.put("/updatecategory/:id", upload.single("image"), updateCategory);
router.delete("/deletecategory/:id", deleteCategory);

router.post("/Cretesubcategory", upload.single("image"), createSubCategory);
router.get("/getbyIdsubcategory/:id", getSubCategoryById);
router.get("/Getsubcategory", getAllSubCategories);
router.put("/Updatesubcategory/:id", upload.single("image"), updateSubCategory);
router.delete("/Deletesubcategory/:id", deleteSubCategory);
router.get("/get-subcategoryby-category/:categoryId", getSubCategoryByCategory);


router.post("/Create-sub-subcategory", upload.single("image"), createSubSubCategory);
router.get("/get-subsubcategory", getAllSubSubCategories);
router.get("/getById-subsubcategory/:id", getSubSubCategoryById);
router.put("/Update_subsubcategory/:id", upload.single("image"), updateSubSubCategory);
router.delete("/subsubcategory/:id", deleteSubSubCategory);
router.get("/get-subsubcategorybysubcategory/:subCategoryId", getSubSubCategoryBySubCategory);


router.post("/create-product", upload.fields([{ name: "images", maxCount: 10 }, { name: "certificate", maxCount: 1 }, { name: "video", maxCount: 1 }]), createProduct);
router.put("/update-product/:id", upload.fields([{ name: "images", maxCount: 10 }, { name: "video", maxCount: 1 }, { name: "certificate", maxCount: 5 }]), updateProduct);
router.get("/getAllProducts", getAllProducts);
router.get('/getProductsByType/:type', getProductsByType);
router.get("/products", getAllProductsWithPagination);
router.get("/get-product/:id", getProductById);
router.delete("/Deleteproduct/:id", deleteProduct);
router.get("/getProductsByCategory", getProductsByCategory);
router.get('/getCategoryIdByProducts/:categoryId', getProductsByCategoryId);
router.patch("/product/status/:id", changeProductStatus);

router.post("/upload-certificate", upload.single("file"), uploadCertificate);


// router.post("/createProduct",upload.array("images", 10),createProduct);
// router.get("/getAllProducts",getAllProducts);
// router.put("/UpdateProduct/:id",upload.array("images", 10),updateProduct);

router.post("/userregister", Userregister);
router.post("/userlogin", userLogin);
router.post("/user-forgot-password", userforgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.post("/user-reset-password", userresetPassword);
router.get("/getAllUsers", getAllUsers);
router.get("/getUsersCount", getUsersCount);
router.get("/profileSummary/:userId", getProfileSummary);
router.post("/logout", userLogout);



router.post("/addcart", addToCart);
router.get("/getcart/:userId", getCart);
router.put("/updateCartQuantity/:cartId/item/:itemId", updateCartItem);
router.delete("/removeCart/:cartId/item/:itemId", removeCartItem);
router.delete("/clearCart/clear/:userId", clearCart);



router.post("/wishlist", addToWishlist);
router.get("/wishlist/:userId", getWishlist);
router.delete("/wishlist/:wishlistId/item/:itemId", removeWishlistItem);

router.post("/Createaddress", createAddress);
router.get("/address/:userId", getAddresses);
router.get("/addressbyid/:id", getAddressById);
router.put("/updateaddress/:id", updateAddress);
router.delete("/Deleteaddress/:id", deleteAddress);
router.get("/getAllAddress", getAllAddresses);
router.post("/setDefaultAddress/:id", setDefaultAddress);


router.post("/create-coupon", createCoupon);
router.get("/getall-coupon", getAllCoupons);
router.get("/getbyid-coupon/:id", getCouponById);
router.put("/updatecoupon/:id", updateCoupon);
router.delete("/Deletecoupon/:id", deleteCoupon);


// router.post("/create-review",createReview);
router.post("/create-review", upload.fields([{ name: "images", maxCount: 10 }, { name: "videos", maxCount: 2 }]), createReview);

router.get("/getall-review", getAllReviews);
router.get("/getbyid-review/:id", getReviewById);
router.get("/product-reviews/:productId", getProductReviews);
router.put("/update-review/:id", updateReview);
router.delete("/delete-review/:id", deleteReview);

/*
CREATE
*/
router.post("/createBanner", upload.single("image"), createBanner);
router.get("/getAllBanners", getAllBanners);
router.delete("/deleteBanner/:id", deleteBanner);
router.put("/updateBanner/:id", upload.single("image"), updateBanner);




router.post("/createMetalRate", createMetalRate);
router.get("/getAllMetalRates", getAllMetalRates);
router.get("/getMetalRateById/:id", getMetalRateById);
router.put("/updateMetalRate/:id", updateMetalRate);
router.delete("/deleteMetalRate/:id", deleteMetalRate);
router.patch("/toggleMetalRateStatus/:id/status", toggleMetalRateStatus);


router.post("/createStoneRate", createStoneRate);
router.get("/getAllStoneRates", getAllStoneRates);
router.get("/getStoneRateById/:id", getStoneRateById);
router.put("/updateStoneRate/:id", updateStoneRate);
router.delete("/deleteStoneRate/:id", deleteStoneRate);
router.patch("/toggleStoneRateStatus/:id/status", toggleStoneRateStatus);


router.post("/create-size-chart", upload.single("image"), createSizeChart);
router.get("/get-all-size-charts", getAllSizeCharts);
router.get("/get-size-chart-by-sub-category/:subCategoryId", getSizeChartBySubCategory);
router.put("/update-size-chart/:id", upload.single("image"), updateSizeChart);
router.delete("/delete-size-chart/:id", deleteSizeChart);

router.post("/createOrder", createOrder);
router.get("/getAllOrders", getAllOrders);
router.get("/get-order/:id", getOrderById);
// router.get("/getOrder/:id", getOrderById);
router.get("/getOrdersByUser/:userId", getOrdersByUser);
router.get("/getBranchOrders/:branchId", getBranchOrders);
router.get("/getSubBranchOrders/:subBranchId", getSubBranchOrders);
router.post("/calculatePrice", calculatePrice);
router.delete("/delete-order/:id", deleteOrder);

router.post("/create-ads", createAds);
router.post(
  "/createAds",
  upload.fields([
    { name: "section1Images", maxCount: 1 },
    { name: "section2Images", maxCount: 1 },
    { name: "section3Images", maxCount: 1 }
  ]),
  createAds
);
router.get("/get-all-ads", getAllAds);
router.get("/get-ads/:id", getAdsById);
router.put(
  "/updateSection/:id",
  upload.single("image"),
  updateSection
);
router.delete("/delete-ads/:id", deleteAds);
router.put(
  "/updateAdsStatus/:id",
  updateAdsStatus
);


// CREATE

router.post(

  "/create-employee",

  upload.fields([

    {

      name: "photo",

      maxCount: 1

    },

    {

      name: "aadhaarImage",

      maxCount: 1

    }

  ]),
  createEmployee

);


router.get(
  '/get-all-employees',
  getAllEmployees
);

router.get(
  '/get-employeebyid/:id',
  getEmployeeById
);

router.get(
  "/branch-employees",
  verifyToken,
  getEmployeesByBranch
);

router.put(

  "/update-employee/:id",

  upload.fields([

    {

      name: "photo",

      maxCount: 1

    },

    {

      name: "aadhaarImage",

      maxCount: 1

    }

  ]),

  updateEmployee

);
router.post(
  "/create-employee",
  verifyToken,
  createEmployee
);

router.delete(
  '/delete-employee/:id',
  deleteEmployee
);

router.post(
  "/assign-product",
  verifyToken,
  assignProductToSubBranch
);
router.get(
  "/assigned-products",
  verifyToken,
  getAssignedProducts
);
// router.get("/assigned-products/:subBranchId", getAssignedProducts);
router.post("/return-product", returnAssignedProduct);
router.post(
  "/assign-multiple-products",
  verifyToken,
  assignMultipleProducts
);
router.get(
  "/getassigned-products/:subBranchId",
  verifyToken,
  getAssignedProductsBySubBranch
);
router.get(
  "/my-assigned-products",
  verifyToken,
  getAssignedProductsBySubBranch
);

// sceams 
// Create
router.post("/create-scheme", createScheme);
router.get("/get-all-schemes", getAllSchemes);
router.get("/get-scheme/:id", getSchemeById);
router.put("/update-scheme/:id", updateScheme);
router.put("/update-scheme-status/:id", updateSchemeStatus);
router.delete("/delete-scheme/:id", deleteScheme);

// userschem-scheema
router.post("/create-user-scheme", createUserScheme);
router.get("/get-all-user-schemes", getAllUserSchemes);
router.get("/get-user-scheme/:userId", getUserSchemeByUserId);
router.put("/update-user-scheme/:id", updateUserScheme);
router.delete("/delete-user-scheme/:id", deleteUserScheme);
router.get("/get-user-scheme/:userId/:userSchemeId", getUserSchemeById);

router.post("/create-payment", createPayment);
router.get("/get-all-payments", getAllPayments);
router.get("/get-payment/:id", getPaymentById);
router.put("/update-payment/:id", updatePayment);
router.delete("/delete-payment/:id", deletePayment);
router.get("/get-user-payments/:userId", getUserPayments);
router.get("/get-payment-history/:subscriptionId", getPaymentHistory);



// Supplier Purchase routes
router.post("/create-supplier", createSupplier);
router.get("/get-all-suppliers", getAllSuppliers);
router.get("/get-active-suppliers", getActiveSuppliers);
router.get("/get-supplier/:id", getSupplierById);
router.put("/update-supplier/:id", updateSupplier);
router.delete("/delete-supplier/:id", deleteSupplier);
router.put("/update-supplier-status/:id", updateSupplierStatus);



// Supplier Purchase
router.post("/create-supplier-purchase", upload.array("documents", 10), createSupplierPurchase);
router.get("/get-all-supplier-purchases", getAllSupplierPurchases);
router.get("/get-supplier-purchase/:id", getSupplierPurchaseById);
router.put("/update-supplier-purchase/:id", upload.array("documents", 10), updateSupplierPurchase);
router.get("/get-supplier-purchases/:supplierId", getSupplierPurchases);
router.post("/add-purchase-document/:id", upload.single("document"), addPurchaseDocument);
router.delete("/delete-purchase-document/:id/:documentId", deletePurchaseDocument);
router.put("/update-purchase-payment-status/:id", updatePurchasePaymentStatus);
router.put("/update-supplier-purchase-status/:id", updateSupplierPurchaseStatus);
router.delete("/delete-supplier-purchase/:id", deleteSupplierPurchase);



// Supplier Purchase Items

router.post("/create-supplier-purchase-item", createSupplierPurchaseItem);
router.get("/get-all-supplier-purchase-items", getAllSupplierPurchaseItems);
router.get("/get-purchase-items/:purchaseId", getPurchaseItemsByPurchase);
router.get("/get-product-purchase-items/:productId", getPurchaseItemsByProduct);
router.get("/get-variant-purchase-items/:variantId", getPurchaseItemsByVariant);
router.put("/update-supplier-purchase-item/:id", updateSupplierPurchaseItem);
router.delete("/delete-supplier-purchase-item/:id", deleteSupplierPurchaseItem);



router.post("/create-maker", createMaker);
router.get("/get-all-makers", getAllMakers);
router.get("/get-active-makers", getActiveMakers);
router.get("/get-maker/:id", getMakerById);
router.put("/update-maker/:id", updateMaker);
router.delete("/delete-maker/:id", deleteMaker);
router.put("/update-maker-status/:id", updateMakerStatus);



router.post("/create-maker-production", createMakerProduction);
router.get("/get-all-maker-productions", getAllMakerProductions);
router.get("/get-maker-production/:id", getMakerProductionById);
router.get("/get-maker-productions/:makerId", getMakerProductionsByMaker);
router.put("/update-maker-production/:id", updateMakerProduction);
router.put("/update-maker-production-status/:id", updateMakerProductionStatus);
router.delete("/delete-maker-production/:id", deleteMakerProduction);



router.post("/create-maker-production-item", createMakerProductionItem);
router.get("/get-all-maker-production-items", getAllMakerProductionItems);
router.get("/get-production-items/:productionId", getProductionItems);
router.get("/get-product-production-items/:productId", getProductProductionItems);
router.get("/get-variant-production-items/:variantId", getVariantProductionItems);
router.get("/get-maker-production-item/:id", getMakerProductionItemById);
router.put("/update-maker-production-item/:id", updateMakerProductionItem);
router.delete("/delete-maker-production-item/:id", deleteMakerProductionItem);


module.exports = router;
