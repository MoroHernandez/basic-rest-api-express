import mysql from 'mysql2/promise'

const config = {
    host: 'localhost',
    user: 'root',
    port: 3306,
    password: '1234',
    database: 'moviesdb'
}

const connection = await mysql.createConnection(config)

export class MovieModel {
    static async getAll ({genre}) {

        if (genre) {
            const lowerCaseGenre = genre.toLowerCase()
        
            const [genres] = await connection.query(
                'SELECT id, name FROM genre WHERE LOWER(name) = ?;', [lowerCaseGenre]
            )

            if (genres.length === 0) return []

            const { id } = genres[0]
            
            const [moviesIds] = await connection.query(
                'SELECT movie_id FROM movie_genres WHERE genre_id =?;', [id]
            )

            if (moviesIds.length === 0) return []
            
            const movieIdList = moviesIds.map(({movie_id}) => movie_id)
                       
            const [movies] = await connection.query(
                'SELECT BIN_TO_UUID(id) id, title, year, director, duration, poster, rate FROM movie WHERE id IN (?);', [movieIdList]
            )
            
            return movies
        }
        
        const [movies] = await connection.query(
            'SELECT BIN_TO_UUID(id) id, title, year, director, duration, poster, rate FROM movie;'
        )

        return movies
    }

    static async getById ({id}) {
        const [movies] = await connection.query(
            'SELECT BIN_TO_UUID(id) id, title, year, director, duration, poster, rate FROM movie WHERE id = UUID_TO_BIN(?);',
        [id]
        )

        if (movies.lenght === 0) return null

        return movies[0]
    }

    static async create({ input }) {
        const {
            genre: genreInput, // genre is an array
            title,
            year,
            duration,
            director,
            rate,
            poster,
        } = input;
    
        try {

            const [uuidResult] = await connection.query('SELECT UUID() uuid;');
            const [{ uuid }] = uuidResult;

            console.log(uuid);
    
            await connection.query(
                'INSERT INTO movie (title, year, director, duration, poster, rate, id) VALUES (?, ?, ?, ?, ?, ?, UUID_TO_BIN(?));',
                [title, year, director, duration, poster, rate, uuid]
            );
    
            const [movieIdResult] = await connection.query(
                'SELECT id FROM movie WHERE id = UUID_TO_BIN(?);',
                [uuid]
            );
    
            if (movieIdResult.length === 0) {
                throw new Error('Error creating movie');
            }
    
            const [{ id: movieId }] = movieIdResult;
    
            if (genreInput && genreInput.length > 0) {
        
                const [genreIdsResult] = await connection.query(
                    'SELECT id FROM genre WHERE name IN (?);',
                    [genreInput]
                );
            
                const genreIds = genreIdsResult.map(({ id }) => id);
            
                const genreValues = genreIds.map((genreId) => [movieId, genreId]);
            
                await connection.query(
                    'INSERT INTO movie_genres (movie_id, genre_id) VALUES ?',
                    [genreValues]
                );
            }
    
            const [moviesResult] = await connection.query(
                `SELECT movie.title, movie.year, movie.director, movie.duration, movie.poster, movie.rate, BIN_TO_UUID(movie.id) AS movie_id, genre.name
                FROM movie
                LEFT JOIN movie_genres ON movie.id = movie_genres.movie_id
                LEFT JOIN genre ON movie_genres.genre_id = genre.id
                WHERE movie.id = UUID_TO_BIN(?);`,
                [uuid]
            );
    
            const [movieInfo] = moviesResult;

            return {
                title: movieInfo.title,
                year: movieInfo.year,
                director: movieInfo.director,
                duration: movieInfo.duration,
                poster: movieInfo.poster,
                rate: movieInfo.rate,
                genre: genreInput,
            };

        } catch (e) {
            console.error('Error creating movie:', e);
            throw new Error('Error creating movie');
        }
    }
    

    static async delete ({id}) {

        try {
            const [result] = await connection.query(
                'DELETE FROM movie WHERE id = UUID_TO_BIN(?);',
                [id]
            )
        
            if (result.affectedRows === 0) {
                throw new Error('Movie not found')
            }

            return { success: true, message: 'Movie deleted successfully'}

        } catch (e) {
            console.error('Error deleting movie: ', e);
            throw new Error('Error deleting movie')
        }
    }

    static async update({ id, input }) {
        const {
            title,
            year,
            duration,
            director,
            rate,
            poster,
            genre: genreInput,
        } = input;
    
        try {
            
            const [existingMovie] = await connection.query(
                'SELECT * FROM movie WHERE id = UUID_TO_BIN(?);',
                [id]
            );
    
            if (existingMovie.length === 0) {
                throw new Error('Movie not found');
            }
            
            let updateQuery = 'UPDATE movie SET';
            const updateParams = [];

            if (title) {
                updateQuery += ' title = ?,';
                updateParams.push(title);
            }

            if (year) {
                updateQuery += ' year = ?,';
                updateParams.push(year);
            }

            if (duration) {
                updateQuery += ' duration = ?,';
                updateParams.push(duration);
            }

            if (director) {
                updateQuery += ' director = ?,';
                updateParams.push(director);
            }

            if (rate) {
                updateQuery += ' rate = ?,';
                updateParams.push(rate);
            }

            if (poster) {
                updateQuery += ' poster = ?,';
                updateParams.push(poster);
            }

            updateQuery = updateQuery.slice(0, -1);

            updateQuery += ' WHERE id = UUID_TO_BIN(?);';
            updateParams.push(id);

            await connection.query(updateQuery, updateParams);

            if (genreInput && genreInput.length > 0) {
                // Obtener IDs de géneros
                const [genreIdsResult] = await connection.query(
                    'SELECT id FROM genre WHERE name IN (?);',
                    [genreInput]
                );

                const genreIds = genreIdsResult.map(({ id }) => id);

                await connection.query(
                    'DELETE FROM movie_genres WHERE movie_id = UUID_TO_BIN(?);',
                    [id]
                );

                const genreValues = genreIds.map((genreId) => [id, genreId]);

                await connection.query(
                    'INSERT INTO movie_genres (movie_id, genre_id) VALUES ?',
                    [genreValues]
                );
            }

            const [updatedMovie] = await connection.query(
                `SELECT movie.title, movie.year, movie.director, movie.duration, movie.poster, movie.rate, BIN_TO_UUID(movie.id) AS movie_id, genre.name
                FROM movie
                LEFT JOIN movie_genres ON movie.id = movie_genres.movie_id
                LEFT JOIN genre ON movie_genres.genre_id = genre.id
                WHERE movie.id = UUID_TO_BIN(?);`,
                [id]
            );

            return updatedMovie[0];
        
                
        } catch (e) {
            console.error('Error updating movie:', error);
            throw new Error('Error updating movie');
        }   
    }
}
