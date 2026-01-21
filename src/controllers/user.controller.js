import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"  //imported to check user already exist or not
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async(userId) => {
   try{
       const user = await User.findById(userId)
       const accessToken =  user.generateAccessToken()
       const refreshToken = user.generateRefreshTokens()
       
       user.refreshToken =  refreshToken                // saving refresh token in database
       await user.save({validateBeforeSave : false})

       return {accessToken, refreshToken}

   } catch(error){
      throw new ApiError(500,"Something went wrong while generating refresh and access token")
   }
}


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
     //console.log("email:", email);

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
     const existedUser =  await User.findOne({
        $or: [{username}, {email}]   // checking if the given parameters already exist or not 
      })

      if(existedUser){
        throw new ApiError(409, "user with email or username already exist")
      }

      console.log(req.files);

       const avatarLocalPath = req.files?.avatar[0]?.path;
       //const coverImageLocalPath = req.files?.coverImage[0]?.path;

       let coverImageLocalPath;
       if(req.files && Array.isArray(req.files.coverImage)
        && req.files.coverImage.length > 0){
           coverImageLocalPath = req.files.coverImage[0].path
       }


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

 const loginUser = asyncHandler(async (req,res) =>{
        // data from req body
        // check username or email 
        // find the user
        // passord check 
        // generate access and refresh token 
        // send cookies

        //step 1
        const {email,username,password} = req.body

        //step 2
        if(!username || !email){
         throw new ApiError(400, "username or password is required")
        }
      
        const user = await User.findOne({
           $or: [{username},{email}]   // to get value on basis of username or email
        })
   
        //step 3
        if(!user){
         throw new ApiError(404,"user does not exist")
        }

        //step 4 : checking for password
       const isPasswordValid =  await user.isPasswordCorrect(password)

       if(!isPasswordValid){
         throw new ApiError(401,"Invalid user credentials")
        }
      
      // step 5
       const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

      const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

      //step 6 
      const options = {
        httpOnly: true,        // can only be modified by server only
        secure : true
      }

      return res.status(200)
      .cookie("accessToken", accessToken, options)   // can  be in the same line also 
      .cookie("refreshToken", refreshToken, options)
      .json(
         new ApiResponse(
            200,
            {
              user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully"
         )
      )
})

    const logoutUser = asyncHandler(async(req,res) => {
        // clear cookies
        // reset refresh token
        await User.findByIdAndUpdate(
            req.user._id,
            {
               $set: {
                  refreshToken: undefined
               }
            },
            {
               new: true
            }
         )
       const options = {
        httpOnly: true,        // can only be modified by server only
        secure : true
      }
       
      return res.status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User logged out"))
   })

   export {
    registerUser,
    loginUser,
    logoutUser
}  // will import these in app.js