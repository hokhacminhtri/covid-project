const { parseSortStr } = require('../../helpers/index.helpers');

const { Sequelize } = require('sequelize');
const {
	formatCurrency,
	getPackageList,
} = require('../../helpers/index.helpers');
const { MAX } = require('../../constants/index.constant');
const { Op } = require('../../configs/db.config');
const ProductInPackage = require('../../models/product-in-package.model');
const ProductPackage = require('../../models/product-package.model');
const Product = require('../../models/product.model');
const ProductImage = require('../../models/product-image.model');

exports.getProductPackage = async (req, res) => {
	let {
		keyword = '',
		sortByPrice = -1,
		sortByName = -1,
		priceFrom = 0,
		priceTo = 0,
	} = req.query;

	sortByName = parseInt(sortByName);
	if (isNaN(sortByName)) {
		sortByName = -1;
	}

	sortByPrice = parseInt(sortByPrice);
	if (isNaN(sortByPrice)) {
		sortByPrice = -1;
	}

	priceFrom = parseInt(priceFrom);
	if (isNaN(priceFrom)) {
		priceFrom = 0;
	}

	priceTo = parseInt(priceTo);
	if (isNaN(priceTo)) {
		priceTo = 0;
	}

	if (priceFrom > priceTo && priceTo !== 0) {
		[priceFrom, priceTo] = [priceTo, priceFrom];
	}

	try {
		const packageData = await getPackageList(1, 12, {
			keyword,
			sortByName,
			sortByPrice,
			priceFrom,
			priceTo,
		});
		const { packages } = packageData;

		res.render('./management/product-packages/view-list', {
			packages,
			searchKeyword: keyword,
			sortByPrice,
			sortByName,
			priceFrom,
			priceTo,
			helpers: {
				formatCurrency,
			},
		});
	} catch (error) {
		console.error('Function getProductPackage Error: ', error);
		return res.render('404');
	}
};

exports.getPackageDetail = async (req, res) => {
	const { packageId } = req.params;
	try {
		let package = {},
			products = [];
		const promises = [];
		const productPhotoPromises = [];

		promises.push(
			ProductPackage.findOne({
				raw: true,
				where: { productPackageId: packageId },
				attributes: {},
			}).then((data) => (package = { ...data }))
		);

		promises.push(
			ProductInPackage.findAll({
				raw: true,
				attributes: [
					'maxQuantity',
					'productId',
					[Sequelize.col('Product.productName'), 'productName'],
					[Sequelize.col('Product.price'), 'productPrice'],
					[Sequelize.col('Product.unit'), 'productUnit'],
				],
				where: {
					productPackageId: packageId,
				},
				include: {
					model: Product,
					attributes: [],
				},
			}).then((data) => {
				products = [...data];
				data.forEach((p) =>
					productPhotoPromises.push(
						ProductImage.findAll({
							raw: true,
							where: { productId: p.productId },
							attributes: ['src'],
							order: [['isThumbnail', 'DESC']],
							limit: 6,
						}).then((photos) => {
							p.thumbnail = photos[0];
							p.photos = [...photos.slice(1).map((i) => i.src)];
						})
					)
				);
			})
		);

		await Promise.all(promises);
		await Promise.all(productPhotoPromises);

		return res.render('./management/product-packages/package-detail.pug', {
			package,
			products,
			helpers: {
				formatCurrency,
			},
		});
	} catch (error) {
		console.error('Function getPackageDetail Error: ', error);
		return res.render('404');
	}
};

exports.getNewPackage = async (req, res) => {
	return res.render('./management/product-packages/new-package.pug');
};

exports.postNewPackage = async (req, res) => {
	let {
		productPackageName,
		limitedProducts,
		limitedInWeek,
		limitedInDay,
		limitedInMonth,
		productId,
		maxQuantity,
	} = req.body;
	try {
		// check package existence
		const isPackageExist = await ProductPackage.findOne({
			raw: true,
			attributes: ['productPackageId'],
			where: {
				productPackageName: Sequelize.where(
					Sequelize.fn('LOWER', Sequelize.col('productPackageName')),
					productPackageName.toLowerCase()
				),
			},
		});

		if (isPackageExist) {
			return res.render('./management/product-packages/new-package.pug', {
				productPackageName,
				msg: 'Gói nhu yếu phẩm đã tồn tại',
			});
		}

		// Create a new package
		const productPackage = await ProductPackage.create({
			productPackageName,
			limitedProducts,
			limitedInDay,
			limitedInWeek,
			limitedInMonth,
		});

		if (!productPackage) {
			throw new Error('Failed to create a new package');
		}

		const { productPackageId } = productPackage;

		// Add a product into this package
		const productInPackage = await ProductInPackage.create({
			maxQuantity,
			productId,
			productPackageId,
		});

		if (!productInPackage) {
			throw new Error('Failed to add a product into this package');
		}

		return res.render('./management/product-packages/new-package.pug', {
			productPackageName,
			isSuccess: true,
			msg: 'Thêm gói nhu yếu phẩm thành công',
		});
	} catch (error) {
		console.error('Function postNewPackage Error: ', error);
		return res.render('./management/product-packages/new-package.pug', {
			productPackageName,
			msg: 'Thêm gói nhu yếu phẩm thất bại ! Thử lại',
		});
	}
};

exports.putUpdatePackage = async (req, res) => {
	try {
		let { productPackageId, newPackageName, newLP, newLID, newLIW, newLIM } =
			req.body;

		const package = await ProductPackage.findOne({
			raw: true,
			where: { productPackageId },
		});
		if (!package) {
			return res.status(400).json({ msg: 'Gói nhu yếu phẩm không tồn tại' });
		}

		// update package name
		await ProductPackage.update(
			{ productPackageName: newPackageName },
			{ where: { productPackageId } }
		);

		// update limited product
		await ProductPackage.update(
			{ limitedProducts: newLP },
			{ where: { productPackageId } }
		);

		// update limited in day
		await ProductPackage.update(
			{ limitedInDay: newLID },
			{ where: { productPackageId } }
		);

		// update limited in week
		await ProductPackage.update(
			{ limitedInWeek: newLIW },
			{ where: { productPackageId } }
		);

		// update limited in month
		await ProductPackage.update(
			{ limitedInMonth: newLIM },
			{ where: { productPackageId } }
		);

		return res.status(200).json({});
	} catch (error) {
		console.error('Function putUpdatePackage Error: ', error);
		return res.status(400).json({ msg: 'Cập nhật thất bại !' });
	}
};

exports.deletePackage = async (req, res) => {
	const productPackageId = parseInt(req.params.packageId);
	if (!productPackageId || isNaN(productPackageId)) {
		return res.status(400).json({});
	}

	try {
		const nRowAffected = await ProductPackage.destroy({
			where: { productPackageId },
			cascade: true,
		});

		if (nRowAffected) {
			return res.status(200).json({});
		}

		return res.status(409).json({});
	} catch (error) {
		console.error('Function deleteProduct Error: ', error);
		return res.status(409).json({});
	}
};
