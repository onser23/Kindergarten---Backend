const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Child = require("../models/Child");
const Package = require("../models/Package");
const Group = require("../models/Group");
const Nanny = require("../models/Nanny");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");

router.post(
  "/login",
  [
    body("username")
      .isEmail()
      .withMessage("Düzgün email formatı daxil edin")
      .normalizeEmail(),
    body("password").notEmpty().withMessage("Şifrə tələb olunur"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validasiya xətası",
          errors: errors.array(),
        });
      }

      const { username, password } = req.body;

      const child = await Child.findOne({
        username: username.toLowerCase(),
        isActive: true,
      })
        .populate("package", "name price days duration")
        .populate({
          path: "group",
          select: "name departments ageRange",
          populate: [
            { path: "teachers", select: "firstName lastName fatherName phone" },
            { path: "nannies", select: "firstName lastName fatherName phone" },
          ],
        });

      if (!child) {
        return res.status(401).json({
          success: false,
          message: "Email və ya şifrə yanlışdır",
        });
      }

      const isMatch = await child.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Email və ya şifrə yanlışdır",
        });
      }

      const token = jwt.sign(
        {
          id: child._id,
          username: child.username,
          role: "child",
        },
        process.env.JWT_SECRET,
        { expiresIn: "30d" },
      );

      const childObj = child.toObject();
      delete childObj.password;

      res.json({
        success: true,
        message: "Uğurla daxil oldunuz",
        token,
        data: childObj,
      });
    } catch (error) {
      console.error("Uşaq login xətası:", error);
      res.status(500).json({
        success: false,
        message: "Server xətası",
        error: error.message,
      });
    }
  },
);

router.use(auth);

router.get("/me", async (req, res) => {
  try {
    if (req.user.role !== "child") {
      return res.status(403).json({
        success: false,
        message: "Bu əməliyyat üçün icazəniz yoxdur",
      });
    }

    const child = await Child.findById(req.user.id)
      .populate("package", "name price days duration")
      .populate({
        path: "group",
        select: "name departments ageRange",
        populate: [
          { path: "teachers", select: "firstName lastName fatherName phone" },
          { path: "nannies", select: "firstName lastName fatherName phone" },
        ],
      });

    if (!child || !child.isActive) {
      return res.status(404).json({
        success: false,
        message: "Uşaq tapılmadı",
      });
    }

    const childObj = child.toObject();
    delete childObj.password;

    res.json({
      success: true,
      data: childObj,
    });
  } catch (error) {
    console.error("Uşaq məlumatları xətası:", error);
    res.status(401).json({
      success: false,
      message: "Token etibarsızdır",
      error: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const { search, status = "active" } = req.query;
    let query = {};
    if (status === "active") query.isActive = true;
    else if (status === "passive") query.isActive = false;

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query = {
        isActive: true,
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { fatherName: searchRegex },
          { motherName: searchRegex },
          { phone1: searchRegex },
          { phone2: searchRegex },
          { username: searchRegex },
        ],
      };
    }

    const children = await Child.find(query)
      .populate("package", "name price days")
      .populate({
        path: "group",
        select: "name departments ageRange",
        populate: [
          { path: "teachers", select: "firstName lastName fatherName" },
          { path: "nannies", select: "firstName lastName fatherName" },
        ],
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: children.length,
      data: children,
    });
  } catch (error) {
    console.error("Uşaqları gətirmə xətası:", error);
    res.status(500).json({
      success: false,
      message: "Server xətası",
      error: error.message,
    });
  }
});

router.get("/form-data", async (req, res) => {
  try {
    const [packages, groups, nannies] = await Promise.all([
      Package.find({ isActive: true })
        .select("_id name price days")
        .sort({ name: 1 }),
      Group.find({ isActive: true })
        .select("_id name departments")
        .sort({ name: 1 }),
      Nanny.find({ isActive: true })
        .select("_id firstName lastName fatherName")
        .sort({ lastName: 1 }),
    ]);

    res.json({
      success: true,
      data: {
        packages: packages.map((p) => ({
          _id: p._id,
          name: p.name,
          price: p.price,
          days: p.days,
        })),
        groups: groups.map((g) => ({
          _id: g._id,
          name: g.name,
          departments: g.departments,
        })),
        nannies: nannies.map((n) => ({
          _id: n._id,
          fullName: `${n.lastName} ${n.firstName} ${n.fatherName}`,
        })),
      },
    });
  } catch (error) {
    console.error("Form data xətası:", error);
    res.status(500).json({
      success: false,
      message: "Server xətası",
      error: error.message,
    });
  }
});

router.post(
  "/",
  [
    body("firstName").trim().notEmpty().withMessage("Ad tələb olunur"),
    body("lastName").trim().notEmpty().withMessage("Soyad tələb olunur"),
    body("birthDate").isISO8601().withMessage("Düzgün tarix formatı"),
    body("fatherName").optional().trim(),
    body("motherName").optional().trim(),
    body("phone1")
      .matches(/^\+994[0-9]{9}$/)
      .withMessage("Düzgün telefon nömrəsi daxil edin (məs: +994551234567)"),
    body("phone2")
      .optional()
      .matches(/^\+994[0-9]{9}$/)
      .withMessage("Düzgün telefon nömrəsi daxil edin"),
    body("username")
      .isEmail()
      .withMessage("Düzgün email formatı daxil edin")
      .normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Şifrə ən az 6 simvol olmalıdır"),
    body("package").notEmpty().withMessage("Paket seçilməlidir"),
    body("group").notEmpty().withMessage("Qrup seçilməlidir"),
    body("startDate").isISO8601().withMessage("Düzgün tarix formatı"),
    body("discount")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Endirim 0-dan kiçik ola bilməz"),
    body("extraPrice")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Əlavə qiymət 0-dan kiçik ola bilməz"),
    body("notes").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validasiya xətası",
          errors: errors.array(),
        });
      }

      const existingChild = await Child.findOne({
        username: req.body.username.toLowerCase(),
      });
      if (existingChild) {
        return res.status(400).json({
          success: false,
          message: "Bu email artıq istifadə edilir",
        });
      }

      const selectedPackage = await Package.findById(req.body.package);
      if (!selectedPackage) {
        return res.status(400).json({
          success: false,
          message: "Paket tapılmadı",
        });
      }

      const child = await Child.create({
        ...req.body,
        discount: parseFloat(req.body.discount || 0),
        extraPrice: parseFloat(req.body.extraPrice || 0),
        currentDebt: selectedPackage.price,
      });

      const populatedChild = await Child.findById(child._id)
        .populate("package", "name price days")
        .populate({
          path: "group",
          select: "name departments ageRange",
          populate: [
            { path: "teachers", select: "firstName lastName fatherName" },
            { path: "nannies", select: "firstName lastName fatherName" },
          ],
        });

      res.status(201).json({
        success: true,
        message: "Uşaq uğurla əlavə edildi",
        data: populatedChild,
      });
    } catch (error) {
      console.error("Uşaq əlavə etmə xətası:", error);
      res.status(500).json({
        success: false,
        message: "Server xətası",
        error: error.message,
      });
    }
  },
);

router.put(
  "/:id",
  [
    body("firstName")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Ad boş ola bilməz"),
    body("lastName")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Soyad boş ola bilməz"),
    body("birthDate")
      .optional()
      .isISO8601()
      .withMessage("Düzgün tarix formatı"),
    body("fatherName").optional().trim(),
    body("motherName").optional().trim(),
    body("phone1")
      .optional()
      .matches(/^\+994[0-9]{9}$/)
      .withMessage("Düzgün telefon nömrəsi daxil edin"),
    body("phone2")
      .optional()
      .matches(/^\+994[0-9]{9}$/)
      .withMessage("Düzgün telefon nömrəsi daxil edin"),
    body("username")
      .optional()
      .isEmail()
      .withMessage("Düzgün email formatı daxil edin")
      .normalizeEmail(),
    body("password")
      .optional()
      .isLength({ min: 6 })
      .withMessage("Şifrə ən az 6 simvol olmalıdır"),
    body("package").optional().notEmpty().withMessage("Paket seçilməlidir"),
    body("group").optional().notEmpty().withMessage("Qrup seçilməlidir"),
    body("startDate")
      .optional()
      .isISO8601()
      .withMessage("Düzgün tarix formatı"),
    body("discount")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Endirim 0-dan kiçik ola bilməz"),
    body("extraPrice")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Əlavə qiymət 0-dan kiçik ola bilməz"),
    body("notes").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validasiya xətası",
          errors: errors.array(),
        });
      }

      if (req.body.username) {
        const existingChild = await Child.findOne({
          username: req.body.username.toLowerCase(),
          _id: { $ne: req.params.id },
        });
        if (existingChild) {
          return res.status(400).json({
            success: false,
            message: "Bu email artıq istifadə edilir",
          });
        }
      }

      const oldChild = await Child.findById(req.params.id);
      if (!oldChild) {
        return res.status(404).json({
          success: false,
          message: "Uşaq tapılmadı",
        });
      }

      let debtDelta = 0;
      let newPackage = null;
      if (req.body.package && req.body.package !== oldChild.package.toString()) {
        newPackage = await Package.findById(req.body.package);
        const oldPackage = await Package.findById(oldChild.package);
        if (newPackage && oldPackage) {
          debtDelta = newPackage.price - oldPackage.price;
        }
      }

      const updateData = {};
      const fields = [
        "firstName",
        "lastName",
        "birthDate",
        "fatherName",
        "motherName",
        "phone1",
        "phone2",
        "username",
        "password",
        "package",
        "group",
        "startDate",
        "notes",
      ];
      fields.forEach((field) => {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
      });
      if (req.body.discount !== undefined)
        updateData.discount = parseFloat(req.body.discount);
      if (req.body.extraPrice !== undefined)
        updateData.extraPrice = parseFloat(req.body.extraPrice);

      // currentDebt yenilə: köhnə borc + fərq (mənfi ola bilər — ailədə kredit qalığı)
      updateData.currentDebt = (oldChild.currentDebt || 0) + debtDelta;

      const child = await Child.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true,
      })
        .populate("package", "name price days")
        .populate({
          path: "group",
          select: "name departments ageRange",
          populate: [
            { path: "teachers", select: "firstName lastName fatherName" },
            { path: "nannies", select: "firstName lastName fatherName" },
          ],
        });

      res.json({
        success: true,
        message: "Uşaq uğurla yeniləndi",
        data: child,
      });
    } catch (error) {
      console.error("Uşaq yeniləmə xətası:", error);
      res.status(500).json({
        success: false,
        message: "Server xətası",
        error: error.message,
      });
    }
  },
);

router.patch(
  "/:id/status",
  [
    body("isActive")
      .isBoolean()
      .withMessage("isActive boolean olmalıdır"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validasiya xətası",
          errors: errors.array(),
        });
      }

      const { isActive } = req.body;
      const child = await Child.findByIdAndUpdate(
        req.params.id,
        { isActive },
        { new: true, runValidators: true },
      )
        .populate("package", "name price days")
        .populate({
          path: "group",
          select: "name departments",
          populate: [
            { path: "teachers", select: "firstName lastName fatherName" },
            { path: "nannies", select: "firstName lastName fatherName" },
          ],
        });

      if (!child) {
        return res.status(404).json({
          success: false,
          message: "Uşaq tapılmadı",
        });
      }

      res.json({
        success: true,
        message: isActive
          ? "Uşaq uğurla aktivləşdirildi"
          : "Uşaq uğurla passivləşdirildi",
        data: child,
      });
    } catch (error) {
      console.error("Status dəyişmə xətası:", error);
      res.status(500).json({
        success: false,
        message: "Server xətası",
        error: error.message,
      });
    }
  },
);

module.exports = router;
