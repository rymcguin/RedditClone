import {Router, Response, Request} from 'express'
import {getConnection} from 'typeorm'

import Post from '../entities/Post'
import User from '../entities/User'
import Vote from '../entities/Vote'
import Comment from '../entities/Comment'
import Sub from '../entities/Sub'

import auth from '../middleware/auth'
import user from '../middleware/user'

const vote =  async (req: Request, res: Response) => {
    const { identifier, slug, commentIdentifier, value} = req.body

    if(![-1,0,1].includes(value)){
        return res.status(400).json({value: 'Value must be -1, 0, or 1'})
    }

    try {
        const user: User = res.locals.user
        let post = await Post.findOneOrFail({identifier, slug})
        let vote: Vote | undefined
        let comment: Comment | undefined

        if(commentIdentifier){
            comment = await Comment.findOneOrFail({identifier: commentIdentifier})
            vote = await Vote.findOne({user, comment})
        }else{
            vote = await Vote.findOne({user, post})
        }
        
        if(!vote && value === 0){
            return res.status(404).json({error: 'Vote not found'})
        }else if (!vote){
            vote = new Vote({user, value})
            if(comment){
                vote.comment = comment
            }else{
                vote.post = post
            }
            await vote.save()
        }else if(value === 0){
            await vote.remove()
        }else if(vote.value !== value){
            vote.value = value
            await vote.save()
        }

        post = await Post.findOneOrFail({identifier, slug}, {relations:['comments', 'sub', 'votes']})

        return res.json(post)

    } catch (err) {
        console.log(err)
        return res.status(500).json({error: "Something went wrong"})
    }
}

const topSubs =  async (_: Request, res: Response) => {
    try {
        const imageUrlExp = `COALESCE('${process.env.APP_URL}/images/' || s."imageUrn" , 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y')`
        const subs = await getConnection()
            .createQueryBuilder()
            .select(`s.title, s.name, ${imageUrlExp} as "imageUrl", count(p.id) as "postCount"`)
            .from(Sub,'s')
            .leftJoin(Post, 'p', `s.name = p."subname"`)
            .groupBy('s.title, s.name, "imageUrl"')
            .orderBy(`"postCount"`, 'DESC')
            .limit(5)
            .execute()

        return res.json(subs)
    } catch (err) {
        console.log(err)
        return res.status(500).json({error:"Someting went wong"})
    }
}

const router = Router()
router.post('/vote', user, auth, vote)
router.get('/top-subs', topSubs)

export default router
 