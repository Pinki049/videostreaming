import {asyncHandler} from "../utils/asyncHandler.js";

// we will register user here
const registerUser = asyncHandler( async (req,res)=>{
      res.status(200).json({
        message:"ok"
    })
})

export {
    registerUser,
}  // will import these in app.js