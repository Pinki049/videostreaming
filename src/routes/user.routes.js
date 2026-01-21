import {Router} from "express";
import { logoutUser, registerUser } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"  //importing for handling files
 

const router = Router()

router.route("/register").post(
    upload.fields([   // injecting middleware
       {
        name: "avatar",
        maxCount: 1
       },
       {
        name: "coverImage",
        maxCount: 1
       }
    ]),
    registerUser
    )

router.route("/login").post(loginUser)


//secured routes
router.route("/logout").post(verifyJWT, logoutUser)


export default router