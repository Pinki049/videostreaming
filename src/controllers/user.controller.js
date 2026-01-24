import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js" ;
import {User} from "../models/user.models.js" ; //imported to check user already exist or not
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) => {
   try{
       const user = await User.findById(userId)

       if (!user) {
      throw new ApiError(404, "User not found while generating tokens");
    }
        
     
       const accessToken =  user.generateAccessToken()
       const refreshToken = user.generateRefreshToken()
       
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
        "-password -refreshToken")  // fields we dont want to select
     

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

       // console.log("LOGIN FUNCTION HIT");

        //step 1
        const {email,username,password} = req.body

        //step 2
        if(!username && !email){
         throw new ApiError(400, "username or email is required")
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
        secure: true
      //   sameSite: "lax",
      //   path: "/"
      };

       //console.log("LOGIN: setting cookies");

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
                  refreshToken: null
               }
            },
            {
               new: true
            }
         )
       const options = {
        httpOnly: true,        // can only be modified by server only
        secure: true
      //   sameSite: "lax",
      //   path: "/"
      };
       
      return res.status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User logged out"))

})

const refreshAccessToken = asyncHandler(async (req,res) => {
   const incomingRefreshToken = req.cookies.
   refreshToken || req.body.refreshToken

   if(!incomingRefreshToken){
      throw new ApiError(401, "Unauthorised request")
   }

 try {
   const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
   )

   const user = await User.findById(decodedToken?._id)

   if(!user){
      throw new ApiError(401, "Invalid request token")
   }

   if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401, "Refresh token is expired or used")
   }

    const options = {
      httpOnly: true,
      secure: true
    }

   const {accessToken, newRefreshToken} = await 
   generateAccessAndRefreshTokens(user._id)

   return res.status(200)
   .cookie("accessToken", accessToken, options)
   .cookie("refreshToken", newRefreshToken, options)
   .json(
      new ApiResponse(
         200,
         {accessToken, newRefreshToken},
         "Access token refreshed succesfully"
      )
   )
 } catch(error){
    throw new ApiError(401, error?.message ||
      "Invalid refresh token")
 }

})

const changeCurrentUserPassword = asyncHandler(async (req,res) =>{
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
      throw new ApiError(400,"Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200)
    .json(new ApiResponse(200, {}, "Passwrod changed successfully"))
})

const getCurrentUser = asyncHandler(async( req,res) => {
    return res.status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if(!fullName || !email ){
      throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            fullName,
            email: email
         }
      },
      {new:true}
    ).select("-password")

    return res.status(200
      .json(new ApiResponse(200, user, "Account details updated successfully"))
    )
})

const updateUserAvatar = asyncHandler(async(req,res) =>{
   const avatarLocalPath = req.file?.path

   if(!avatarLocalPath){
      throw new ApiError(400, "Avatar file is missing")
   }

   // old image to be deleted - todo self

   const avatar = await uploadOnCloudinary(avatarLocalPath)

   if(!avatar.url){
      throw new ApiError(400, "Error while uploading on avatar")  
   }

   const user = await User.findByIdAndUpdate(req.user?._id,
      {
         $set: {
            avatar: avatar.url
         }
      }, {new: true}
   ).select("-password")

   return res.status(200)
   .json(
      new ApiResponse(200, "Avatar updated successfully")
   )
})

const updateUserCoverImage = asyncHandler(async(req,res) =>{
   const coverImageLocalPath = req.file?.path

   if(!coverImageLocalPath){
      throw new ApiError(400, "Cover image file is missing")
   }

   const coverImage = await uploadOnCloudinary(coverImageLocalPath)

   if(!coverImage.url){
      throw new ApiError(400, "Error while uploading the cover image")  
   }

   const user = await User.findByIdAndUpdate(req.user?._id,
      {
         $set: {
            coverImage: coverImage.url
         }
      }, {new: true}
   ).select("-password")

   return res.status(200)
   .json(
      new ApiResponse(200, "Cover image updated successfully")
   )
})

const getUserChannelProfile = asyncHandler(async(req, res) =>{
    const {username} = req.params

    if(!username?.trim){
      throw new ApiError(400, "Username is missing")
    }

    const channel =  await User.aggregate([   // we get arrays after creating aggregation pipelines
      {
          $match: {
          username: username?.toLowerCase()
           }
      },
      {
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
         }
      },
      {
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
         }
      },
      {
         $addFields: {
            subscribersCount:{
               $size: "$subscribers",
            },
            channelsSubscribedToCount: {
               $size: "$subscribedTo"
            },
            isSubscribed: {
               $cond: {
                 if: {$in: [req.user?._id, "subscribers.subscriber"]},
                 then: true,
                 else: false
               }
            }
         }
      },
      {
         $project: {
            fullName: 1,
            username: 1,
            subscribersCount: 1,
            channelsSubscribedToCount: 1,
            isSubscribed: 1,
            avatar: 1,
            coverImage: 1,
            email: 1
         }
      }
    ])

    if(!channel?.length){
      throw new ApiError(404,"Channel does not exist")
    }

    return res.status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

export {
   registerUser,
   loginUser,
   logoutUser,
   refreshAccessToken,
   changeCurrentUserPassword,
   getCurrentUser,
   updateAccountDetails,
   updateUserAvatar,
   updateUserCoverImage,
   getUserChannelProfile
}  // will import these in app.js