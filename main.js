async function getWeather() {
    const city = document.getElementById('city').value;
    const apiKey = '2d2baedd883a44a397a171600251703'; // Replace with your WeatherAPI key
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city}&aqi=no`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            const weatherDiv = document.getElementById('weather');
            weatherDiv.style.display = 'block'; // Show the weather box
            weatherDiv.innerHTML = `
                <h2>${data.location.name}</h2>
                <p>Temperature: ${data.current.temp_c} °C / ${data.current.temp_f} °F</p>
                <p>Weather: ${data.current.condition.text}</p>
            `;
        } else {
            alert('City not found');
        }
    } catch (error) {
        console.error('Error fetching weather data:', error);
    }
}