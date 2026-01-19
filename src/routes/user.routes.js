import {Router} from "express";
import { registerUser } from "../controllers/user.controller.js";
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


export default router