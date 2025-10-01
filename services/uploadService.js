// services/uploadService.js
import axios from 'axios';
import FormData from 'form-data';

const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

export const uploadService = {
    async uploadImageToImgBB(fileBuffer, originalname, mimetype) {
        console.log('Starting ImgBB upload...');

        const formData = new FormData();

        // Convertir le buffer en base64 pour ImgBB
        const base64Image = fileBuffer.toString('base64');
        formData.append('image', base64Image);

        // Optionnel: ajouter un nom de fichier
        if (originalname) {
            formData.append('name', originalname);
        }

        console.log('Sending request to ImgBB...');

        const response = await axios.post(
            `${IMGBB_UPLOAD_URL}?key=${process.env.IMGBB_API_KEY}`,
            formData,
            {
                headers: {
                    ...formData.getHeaders()
                },
                timeout: 30000
            }
        );

        console.log('ImgBB response:', response.data);

        if (!response.data.success) {
            throw new Error('Échec de l\'upload vers ImgBB: ' + JSON.stringify(response.data));
        }

        return response.data.data.url;
    }
};