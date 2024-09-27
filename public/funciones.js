document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('modal-imagen');
    const closeModal = document.querySelector('.close-modal');
    const imageContainer = document.querySelector('.contenedor-imagenes-adicionales');
    const grid = document.querySelector('.grid'); // Referencia a la cuadrícula donde se colocan las imágenes
    let currentPage = 1;
    const itemsPerPage = 20; // Número de elementos por página
    let totalPages = 0;
    let allObjectIDs = []; // Aquí almacenaremos todos los IDs de objetos

    // Función para obtener los IDs de todos los objetos
    async function getAllObjectsFromAPI() {
        try {
            const response = await fetch('/api/objects'); // Cambia a tu ruta API correcta
            if (!response.ok) {
                throw new Error(`Error en la solicitud: ${response.status}`); // Maneja errores HTTP
            }
            const data = await response.json();
            console.log("Total de objectIDs obtenidos:", data.objectIDs.length); // Verificar cuántos objetos se obtienen
            return data.objectIDs; // Suponiendo que devuelves un array de objectIDs
        } catch (error) {
            console.error("Error al obtener todos los objetos:", error);
            return [];
        }
    }

    // Función para cargar una página de objetos
    const loadPage = async (page) => {
        console.log("Cargando página:", page); // Verificar qué página se está intentando cargar
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
    
        console.log("Cargando objetos de", startIndex, "a", endIndex);
        const objectIDsToLoad = allObjectIDs.slice(startIndex, endIndex);

        if (grid) {
            grid.innerHTML = ''; // Limpiar los objetos actuales
        } else {
            console.error("Elemento .grid no encontrado en el DOM.");
            return;
        }

        try {
            // Cargar cada objeto individualmente por ID
            const promises = objectIDsToLoad.map(async (id) => {
                const objectResponse = await fetch(`/object/${id}`);
                const objectData = await objectResponse.json();
                return objectData;
            });

            const objects = await Promise.all(promises);
            console.log("Objetos cargados en esta página:", objects.length);

            if (objects.length === 0) {
                const noObjectsMessage = document.createElement('p');
                noObjectsMessage.textContent = "No se encontraron objetos para mostrar en esta página.";
                grid.appendChild(noObjectsMessage);
                return;
            }

            // Crear las tarjetas para los objetos cargados
            objects.forEach(object => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <img src="${object.primaryImage || '/ruta/a/imagen-predeterminada.jpg'}" alt="${object.title || 'Sin título'}">
                    <div class="date">Fecha: ${object.objectDate || 'Desconocida'}</div>
                    <h3>${object.title || 'Sin título'}</h3>
                    <p>Cultura: ${object.culture || 'Desconocida'}</p>
                    <p>Dinastía: ${object.dynasty || 'Desconocida'}</p>
                    <a class="ver-mas" href="#" data-object-id="${object.objectID}">Ver más</a>
                `;
                grid.appendChild(card);
            });

            assignModalEvent(); // Asignar eventos de modal después de cargar las tarjetas

            document.getElementById('prev-page').disabled = currentPage === 1;
            document.getElementById('next-page').disabled = currentPage === totalPages;
        } catch (error) {
            console.error('Error al cargar la página:', error);
        }
    };

    const assignModalEvent = () => {
        document.querySelectorAll('.ver-mas').forEach(button => {
            button.addEventListener('click', async function(event) {
                event.preventDefault();
                const objectId = this.getAttribute('data-object-id');

                try {
                    const response = await fetch(`/object/${objectId}/additional-images`);
                    const additionalImages = await response.json();

                    imageContainer.innerHTML = '';

                    if (additionalImages.length === 0) {
                        const noImageMessage = document.createElement('p');
                        noImageMessage.textContent = "No hay imágenes adicionales disponibles.";
                        imageContainer.appendChild(noImageMessage);
                    } else {
                        additionalImages.forEach(imageUrl => {
                            const imgElement = document.createElement('img');
                            imgElement.src = imageUrl;
                            imgElement.alt = "Imagen adicional";
                            imgElement.onerror = () => {
                                imgElement.style.display = 'none';
                            };
                            imageContainer.appendChild(imgElement);
                        });
                    }

                    modal.style.display = 'block';
                } catch (error) {
                    console.error('Error al cargar las imágenes adicionales:', error);
                }
            });
        });
    };

    const initPagination = async () => {
        allObjectIDs = await getAllObjectsFromAPI();
        console.log("Total de ObjectIDs:", allObjectIDs);

        if (allObjectIDs.length === 0) {
            console.error("No se encontraron IDs de objetos.");
            return;
        }
        totalPages = Math.ceil(allObjectIDs.length / itemsPerPage);

        if (totalPages === 0) {
            console.error("No hay páginas para mostrar.");
            return;
        }

        loadPage(currentPage); // Cargar la primera página
    };

    const nextPageButton = document.getElementById('next-page');
    const prevPageButton = document.getElementById('prev-page');

    nextPageButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            console.log("Avanzando a la siguiente página:", currentPage);
            loadPage(currentPage);
        }
    });

    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            console.log("Volviendo a la página anterior:", currentPage);
            loadPage(currentPage);
        }
    });

    initPagination();

    const backgroundImage = document.getElementById('backgroundImage');
    if (backgroundImage) {
        backgroundImage.src = '/pictures/imagens.jpeg';
    }

    closeModal.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
});




document.getElementById('close-pagination').addEventListener('click', () => {
    // Redirigir a la página principal
    window.location.href = '/'; // Cambia a la ruta principal de tu aplicación
});

