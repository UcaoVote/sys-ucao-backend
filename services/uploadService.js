// services/uploadService.js
import axios from 'axios';
import FormData from 'form-data';

const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

export const uploadService = {
    async uploadImageToImgBB(fileBuffer, originalname, mimetype) {
        const formData = new FormData();
        formData.append('image', fileBuffer, {
            filename: originalname || 'image.jpg',
            contentType: mimetype
        });

        const response = await axios.post(
            `${IMGBB_UPLOAD_URL}?key=${process.env.IMGBB_API_KEY}`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Content-Type': 'multipart/form-data'
                },
                timeout: 30000
            }
        );

        if (!response.data.success) {
            throw new Error('Échec de l\'upload vers ImgBB: ' + JSON.stringify(response.data));
        }

        return response.data.data.url;
    }
};