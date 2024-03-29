const {
	API_AUTH_HEADER,
	PAYMENT_SYS_AUTH_PRIVATE_KEY,
} = require('../constants/index.constant');
const {
	getPackageList,
	countUserConsumePackage,
} = require('../helpers/index.helpers');
const District = require('../models/district.model');
const IsolationFacility = require('../models/isolation-facility.model');
const PaymentHistory = require('../models/payment-history.model');
const ProductPackage = require('../models/product-package.model');
const Province = require('../models/province.model');
const User = require('../models/user.model');
const Ward = require('../models/ward.model');
const { v4: uuidv4 } = require('uuid');
const Product = require('../models/product.model');

exports.getAllProvince = async (req, res) => {
	try {
		const provinces = await Province.findAll({
			raw: true,
			attributes: ['id', 'name'],
		});
		return res.status(200).json(provinces);
	} catch (error) {
		console.error('Function getAllProvince Error: ', error);
		return res.json([]);
	}
};

exports.getDistrictOfProvince = async (req, res) => {
	let { provinceId } = req.params;
	try {
		const districts = await District.findAll({
			raw: true,
			where: {
				provinceId: Number(provinceId),
			},
		});
		return res.status(200).json(districts);
	} catch (error) {
		console.error('Function getDistrictOfProvince Error: ', error);
		return res.json([]);
	}
};

exports.getWardOfDistrict = async (req, res) => {
	const { districtId } = req.params;

	try {
		const wards = await Ward.findAll({
			raw: true,
			where: { districtId: Number(districtId) },
		});

		return res.status(200).json(wards);
	} catch (error) {
		console.error('Function getWardOfDistrict Error: ', error);
		return res.json([]);
	}
};

exports.getUserWithStatus = async (req, res) => {
	const { statusF } = req.params;
	try {
		const users = await User.findAll({
			raw: true,
			where: { statusF: Number(statusF) },
			attributes: ['uuid', 'fullname', 'peopleId'],
		});
		return res.status(200).json(users);
	} catch (error) {
		console.error('Function getUserWithStatus Error: ', error);
		return res.json([]);
	}
};

exports.getAllIsolationFacilities = async (req, res) => {
	try {
		const isoFacList = await IsolationFacility.findAll({
			raw: true,
			attributes: ['isolationFacilityId', 'isolationFacilityName'],
		});
		return res.status(200).json(isoFacList);
	} catch (error) {
		console.error('Function getAllIsolationFacilities Error: ', error);
		return res.status(200).json([]);
	}
};

exports.getProductPackages = async (req, res) => {
	let {
		page = 1,
		pageSize = 12,
		keyword = '',
		sortByPrice = -1,
		sortByName = -1,
		priceFrom = 0,
		priceTo = 0,
	} = req.query;
	[page, pageSize] = [Number(page), Number(pageSize)];
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
		const packages = await getPackageList(page, pageSize, {
			keyword,
			sortByName,
			sortByPrice,
			priceFrom,
			priceTo,
		});
		return res.status(200).json(packages);
	} catch (error) {
		console.error('Function getProductPackages Error: ', error);
		return res.status(400).json({});
	}
};

exports.getCheckUserLimitPackage = async (req, res) => {
	const { packageId } = req.query;
	try {
		const { userId } = await User.findOne({
			raw: true,
			where: { accountId: req.user.accountId },
			attributes: ['userId'],
		});

		const { limitedInDay, limitedInWeek, limitedInMonth } =
			await ProductPackage.findOne({
				raw: true,
				where: { productPackageId: packageId },
				attributes: ['limitedInDay', 'limitedInWeek', 'limitedInMonth'],
			});

		if (!userId || !limitedInDay) {
			throw new Error();
		}

		const { day, week, month } = await countUserConsumePackage(
			userId,
			packageId
		);

		if (day >= limitedInDay) {
			return res.status(400).json({
				isSuccess: false,
				msg: 'Bạn đã đạt giới hạn mua gói này trong ngày',
			});
		}
		if (week >= limitedInWeek) {
			return res.status(400).json({
				isSuccess: false,
				msg: 'Bạn đã đạt giới hạn mua gói này trong tuần',
			});
		}
		if (month >= limitedInMonth) {
			return res.status(400).json({
				isSuccess: false,
				msg: 'Bạn đã đạt giới hạn mua gói này trong tháng',
			});
		}

		return res.status(200).json({ isSuccess: true });
	} catch (error) {
		console.error('Function getCheckUserLimitPackage Error: ', error);
		return res.status(400).json({ isSuccess: false, msg: 'Kiểm tra thất bại' });
	}
};

exports.getProducts = async (req, res) => {
	try {
		const products = await Product.findAll({
			raw: true,
			attributes: ['productId', 'productName', 'price', 'unit'],
		});
		return res.status(200).json(products);
	} catch (error) {
		console.error('Function getProducts Error: ', error);
		return res.json([]);
	}
};

exports.postNewPaymentHistory = async (req, res) => {
	const {
		paymentDate,
		currentBalance,
		paymentType,
		totalMoney,
		userId,
		consumptionHistoryId = null,
	} = req.body;

	const privateKey = req.headers[API_AUTH_HEADER];
	if (privateKey !== PAYMENT_SYS_AUTH_PRIVATE_KEY) {
		return res.status(403).json({ msg: 'Access Denied!' });
	}

	try {
		const affectedRows = await PaymentHistory.create({
			paymentDate,
			currentBalance,
			paymentType,
			paymentCode: uuidv4(),
			totalMoney,
			userId,
			consumptionHistoryId,
		});

		if (affectedRows) {
			return res.status(201).json({ msg: 'successfully' });
		}
	} catch (error) {
		console.error('Function postAddHistory Error: ', error);
		return res.status(500).json({ msg: 'Server Error !' });
	}
};
