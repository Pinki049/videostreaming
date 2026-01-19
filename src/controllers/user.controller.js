import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"  //imported to check user already exist or not
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
// we will register user here
const registerUser = asyncHandler( async (req,res)=>{
    //  get user details from frontend
    // validation - not empty 
    // check if user already exixts: username, email
    // check for images, check for avatar 
    //upload them to cloudinary, avatar
    // create user object- create entry in db
    // remove password and refresh token field from response
    // check for user creation 
    // return response res

    // step 1
    const {fullName, email, username, password} =req.body
    console.log("email:", email);

   // step 2 - validating
    // if(fullName===""){
    //     throw new ApiError(400, "funllname is required")
    // }
    if(   // to check all the fields at once
        [fullName, email, username, password].some((field)=>
            field?.trim()==="")
      ){ 
        throw new ApiError(400,"all fields are required")
     }

     //step 3
     const existedUser = User.findOne({
        $or: [{username}, {email}]   // checking if the given parameters already exist or not 
      })

      if(existedUser){
        throw new ApiError(409, "user with email or username already exist")
      }

       const avatarLocalPath = req.files?.avatar[0]?.path;
       const coverImageLocalPath = req.files?.coverImage[0]?.path;

       if(!avatarLocalPath){
        throw new ApiError(400, "avatar file is required")
       }

       //step 4 ; upload on cloudinary , usef await as uploading will take time
       const avatar = await uploadOnCloudinary(avatarLocalPath)
       const coverImage = await uploadOnCloudinary(coverImageLocalPath)

       if(!avatar){
         throw new ApiError(400, "avatar file is required")
       }

       // step 4 : entry in database
       const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "", // if cover image is not present then leave empty is its not compulsory
        email,
        password,
        username: username.toLowerCase()
    })

     const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"   // fields we dont want to select
     )

     if(!createdUser){
        throw new ApiError(500, "something went wrong while registering user")
     }

      // last step
     return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered sucessfully")
     )

 })

   export {
    registerUser,
}  // will import these in app.js