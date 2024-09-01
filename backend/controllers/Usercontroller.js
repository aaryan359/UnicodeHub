import { User } from "../models/User.model.js";
import nodemailer from 'nodemailer';

import uploadImage from "../utils/uploadimage.js";

import otpGenerator from 'otp-generator';


import { Otp } from "../models/otp.js";


import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'Gmail', // Replace with your email service provider
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS, // Your email password or app-specific password
  },
});


// function for genrating jwt refread=h and acces token

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) return res.status(500).json({
      message: "jwt creation failed"
    });

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };

  } catch (error) {
    console.log("somthing went wrong while genrating jwt")
  }
};

// api checked
const registerUser = async (req, res) => {
  try {

    const { fullname, email, phonenumber, username, password, otp } = req.body;

    // Validate required fields
    if ([fullname, email, username, password, phonenumber, otp].some(field => !field || field.trim() === "")) {
      return res.status(400).json({
        success: false,
        message: "All fields are required and cannot be empty.",
      });
    }



    // Check if the user already exists
    const existedUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existedUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists.",
      });
    }
    

     const profileimage = req.files.ProfileImage;
     const result = await uploadImage(profileimage, "blogpost")
     console.log(" profile image");
  



    //find most recent otp   send on the provided email

    const recentotp = await Otp.findOne({ email: email }).sort({ createdat: -1 }).limit(1);

    console.log("recent otp is : ", recentotp)

    if (recentotp == 0) {

      //otp not found
      return res.status(400).json({
        success: false,
        message: "zero-length"
      })
    } else if (otp !== recentotp.otp) {

      return res.status(409).json({
        success: false,
        message: "invalid-otp"
      })
    }


    const createduser = await User.create({
      fullname,
      email,
      password,
      phonenumber,
      username,
      verfied:true,
      ProfileImage: result.secure_url
    })

    res.status(200).json({
      success: true,
      message: "user-created succesfully",
      createduser
    });

  }

  catch {
    () => {
      res.status(400).json({
        succes: false,
        message: "error in register user"
      })
    }
  }
};


const sendotp = async (req, res) => {
  try {
    // Fetch email from request body
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email field is required.",
      });
    }

    // Check if user already exists
    const checkUserPresent = await User.findOne({ email });

    if (checkUserPresent) {
      return res.status(409).json({
        success: false,
        message: "User already exists.",
      });
    }

    // Generate OTP
    let otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
      digits: true
    });

    console.log("Generated OTP:", otp);

    // Check if OTP is unique
    let result = await Otp.findOne({ otp });
    while (result) {
      otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
        digits: true
      });


      console.log("New OTP generated:", otp);
      result = await Otp.findOne({ otp });

    }

    // Create entry in DB
    const otpBody = await Otp.create({ email, otp });

    // Send OTP via email
    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender's email address
      to: email, // Recipient's email address
      subject: 'Your OTP Code', // Subject line
      text: `Your verification code is: ${otp}`, // Plain text body
    };


    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
      otpBody
    });

  } catch (error) {
    console.error("Error occurred during OTP send:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP. Please try again.",
    });
  }
};




// const verifyOtp = async (req, res) => {

//   try {
//     const { phonenumber, otp } = req.body;

//     // Find the OTP
//     const otpRecord = await Otp.findOne({ number: phonenumber });
//     if (!otpRecord) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP or phone number.",
//       });
//     }

//     // Compare the entered OTP with the stored hashed OTP
//     const isOtpValid = await bcrypt.compare(otp, otpRecord.otp);
//     if (!isOtpValid) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP.",
//       });
//     }

//     // Extract user details from OTP record
//     const userDetails = otpRecord.userDetails;

//     // Create the user
//     const user = await User.create({
//       ...userDetails,
//       ProfileImage: userDetails.ProfileImage || "",
//       verified: true // Set user as verified
//     });

//     // Remove the OTP record after successful verification
//     await Otp.deleteOne({ number: phonenumber });

//     return res.status(200).json({
//       success: true,
//       message: "OTP verified successfully. User account created.",
//       user
//     });

//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Internal server error.",
//     });
//   }
// };





const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Checking for empty fields
    if ([email, password].some((field) => !field || field.trim() === "")) {
      return res.status(400).json({
        success: false,
        message: "All fields are required and cannot be empty.",
      });
    }

    console.log("Email and password received:", email, password);

    // Checking if the user exists
    const user = await User.findOne({ email }); // Added `await` here
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User doesn't exist.",
      });
    }

    console.log("User found:", user);

    // Checking for password validation
    const isPasswordValid = await user.isPasswordCorrect(password); // Call `isPasswordCorrect` on the user instance
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid password.",
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);


    console.log("Refresh token:", refreshToken);
    console.log("Access token:", accessToken);


    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        success: true,
        message: "Login successful.",
        data: loggedInUser,
        accessToken,
        refreshToken,
      });


  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export { registerUser, login, sendotp };
