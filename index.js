import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import translate from "node-google-translate-skidz";

const app = express();
const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de vistas y archivos estáticos
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "public"));
app.use(express.static(path.join(__dirname, "public")));

// Ruta de inicio
app.get("/", async (req, res) => {
    try {
        // Obtienes los departamentos de la API del Met Museum
        const response = await axios.get('https://collectionapi.metmuseum.org/public/collection/v1/departments');
        const departments = response.data.departments;

        // Crear un arreglo para las promesas de traducción
        const translatedDepartments = await Promise.all(departments.map(async (department) => {
            try {
                const translation = await translate({ text: department.displayName, source: 'en', target: 'es' });
                return {
                    departmentId: department.departmentId, // Mantener el ID sin traducir
                    displayName: translation.translation // Traducir solo el nombre
                };
            } catch (error) {
                console.error(`Error al traducir departamento ${department.displayName}:`, error.message);
                // Si falla la traducción, devolver el nombre original en inglés
                return {
                    departmentId: department.departmentId,
                    displayName: department.displayName
                };
            }
        }));

        // Renderizar la página con los nombres traducidos
        res.render('index', { departments: translatedDepartments });
    } catch (error) {
        console.error('Error al cargar departamentos:', error.response ? error.response.data : error.message);
        res.status(500).send('Error al cargar departamentos.');
    }
});

// Ruta de búsqueda
app.get('/search', async (req, res) => {
    try {
        const departmentId = req.query.departmentId || '';
        const keyword = req.query.keyword || '';
        const location = req.query.location || '';
        const page = parseInt(req.query.page) || 1;  // Agregamos el parámetro de página
        const limit = 20;  // Elementos por página
        const offset = (page - 1) * limit;  // Cálculo del offset

        let url = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true`;

        if (departmentId) {
            url += `&departmentId=${departmentId}`;
        }
        if (keyword) {
            url += `&q=${keyword}`;
        }
        if (location) {
            url += `&geoLocation=${location}`;
        }

        console.log("URL de la API:", url);

        const response = await axios.get(url);

        if (!response.data || !Array.isArray(response.data.objectIDs) || response.data.objectIDs.length === 0) {
            return res.render('results', {
                objects: [],
                currentPage: page,
                totalPages: 0,
                departmentId,
                keyword,
                location,
                message: 'No se encontraron resultados para los filtros aplicados.'
            });
        }

        const objectIDs = response.data.objectIDs.slice(offset, offset + limit);
        const promises = objectIDs.map(async id => {
            try {
                const objectResponse = await axios.get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                const obj = objectResponse.data;

                // Traducción de títulos, cultura, etc.
                if (obj.title) {
                    const translation = await translate({ text: obj.title, source: 'en', target: 'es' });
                    obj.title = translation.translation;
                }
                if (obj.culture) {
                    const translation = await translate({ text: obj.culture, source: 'en', target: 'es' });
                    obj.culture = translation.translation;
                }
                if (obj.dynasty) {
                    const translation = await translate({ text: obj.dynasty, source: 'en', target: 'es' });
                    obj.dynasty = translation.translation;
                }

                return obj;
            } catch (error) {
                console.error(`Error al recuperar el objeto con ID ${id}:`, error.message);
                return null;
            }
        });

        const objects = (await Promise.all(promises)).filter(obj => obj !== null && obj.primaryImage);

        const totalObjects = response.data.total || 0;
        const totalPages = Math.ceil(totalObjects / limit);

        res.render('results', {
            objects,
            currentPage: page,
            totalPages,
            departmentId,
            keyword,
            location
        });
    } catch (error) {
        console.error("Error en la consulta a la API:", error.message, error.stack);
        res.status(500).send(`Error al recuperar los objetos de arte: ${error.message}`);
    }
});

// Ruta para obtener imágenes adicionales de un objeto
app.get('/object/:id/additional-images', async (req, res) => {
    try {
        const objectId = req.params.id;
        const response = await axios.get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`);
        const object = response.data;

        if (object.additionalImages && object.additionalImages.length > 0) {
            res.json(object.additionalImages);
        } else {
            res.json([]);  // Si no hay imágenes adicionales, devolver un array vacío
        }
    } catch (error) {
        console.error('Error al recuperar imágenes adicionales:', error);
        res.status(500).send('Error al recuperar las imágenes adicionales.');
    }
});

// Ruta para obtener y mostrar los resultados en una página con paginación
app.get('/results', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = 10;

    try {
        // Obtener todos los objetos (suponiendo que tienes una función que obtiene todos los IDs de objetos)
        const allObjects = await getAllObjectsFromAPI();

        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        // Obtener solo los objetos para la página actual
        const objectIDs = allObjects.slice(startIndex, endIndex);

        const validObjects = await Promise.all(
            objectIDs.map(async (id) => {
                try {
                    const response = await axios.get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                    return response.data;  // Si el objeto existe, devolverlo
                } catch (error) {
                    if (error.response && error.response.status === 404) {
                        console.error(`Error al recuperar el objeto con ID ${id}: No encontrado (404)`);
                        return null;  // Si no se encuentra el objeto, devuelvo `null`
                    } else {
                        throw error;  // Si es otro error, lanzar el error
                    }
                }
            })
        );

        // Filtrar los objetos válidos que no sean `null`
        const objectsToDisplay = validObjects.filter(obj => obj !== null);

        const totalObjects = allObjects.length;
        const totalPages = Math.ceil(totalObjects / itemsPerPage);

        res.render('results', {
            objects: objectsToDisplay,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error("Error al obtener resultados:", error.message, error.stack);
        res.status(500).send("Error al obtener resultados");
    }
});

// Servidor escuchando en el puerto 3000
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
