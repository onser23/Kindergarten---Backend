require("dotenv").config();
const mongoose = require("mongoose");
const Nanny = require("../models/Nanny");

const connectDB = require("../config/db");

const seedNannies = [
  {
    firstName: "Fatimə",
    lastName: "Əliyeva",
    fatherName: "Asim",
    phone: "+994557897788",
    birthDate: new Date("1986-06-15"),
  },
  {
    firstName: "Samirə",
    lastName: "Vəliyeva",
    fatherName: "Faiz",
    phone: "+994705896633",
    birthDate: new Date("1986-06-17"),
  },
  {
    firstName: "Gülnarə",
    lastName: "Məmmədova",
    fatherName: "Rəşid",
    phone: "+994502345678",
    birthDate: new Date("1990-03-22"),
  },
  {
    firstName: "Aygün",
    lastName: "Hüseynova",
    fatherName: "Kamil",
    phone: "+994553456789",
    birthDate: new Date("1988-11-08"),
  },
];

const seedDatabase = async () => {
  try {
    await connectDB();

    // Clear existing data
    await Nanny.deleteMany({});
    console.log("✅ Köhnə məlumatlar silindi");

    // Insert new data
    await Nanny.insertMany(seedNannies);
    console.log("✅ Demo məlumatlar əlavə edildi");

    console.log(`📊 ${seedNannies.length} baxıcı əlavə edildi`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed xətası:", error);
    process.exit(1);
  }
};

seedDatabase();
