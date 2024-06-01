let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let originalImageData = null;

document.getElementById('upload').addEventListener('change', function(e) {
    let reader = new FileReader();
    
    reader.onload = function(event) {
        let img = new Image();
        
        img.onload = function() {
            let width = img.width;
            let height = img.height;
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            if (originalImageData !== null) {
                let divTools = document.getElementById('tools');
                divTools.classList.remove('hidden');

                let divUpload = document.getElementById('uploadCont');
                divUpload.classList.add('hidden');

                if (width > 1080)
                    canvas.classList.add('max-w-[30rem]')

                if (height > 1080)
                    canvas.classList.add('max-h-[30rem]')

            }
        }
        
        img.src = event.target.result;
    }
    
    reader.readAsDataURL(e.target.files[0]);
});

img.onload = function() {

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyGrayScale(); 
    generateHistogram(ctx.getImageData(0, 0, canvas.width, canvas.height)); 

}

function applyGrayScale() {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = data[i + 1] = data[i + 2] = avg; 
    }
    ctx.putImageData(imageData, 0, 0);
    generateHistogram(imageData); 
}

function applyThreshold() {
    let threshold = document.getElementById('thresholdSlider').value;

    if (threshold === '' || threshold < 0 || threshold > 255) {
        alert('Por favor, ingresa un umbral válido.');
        return;
    }
    
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        let binary = (avg > threshold) ? 255 : 0;
        data[i] = binary;
        data[i + 1] = binary;
        data[i + 2] = binary;
    }
    ctx.putImageData(imageData, 0, 0);
    generateHistogram(imageData);
}

function applyNegativeLaplacianFilter() {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;
    let width = canvas.width;
    let height = canvas.height;

    // Define the negative Laplacian kernel
    let kernel = [
        [0, -1, 0],
        [-1, 4, -1],
        [0, -1, 0]
    ];

    let output = new Uint8ClampedArray(data.length);

    // Apply the Laplacian filter
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    let px = Math.min(width - 1, Math.max(0, x + kx));
                    let py = Math.min(height - 1, Math.max(0, y + ky));
                    let weight = kernel[ky + 1][kx + 1];
                    let idx = (py * width + px) * 4;
                    r += data[idx] * weight;
                    g += data[idx + 1] * weight;
                    b += data[idx + 2] * weight;
                }
            }
            let idx = (y * width + x) * 4;
            output[idx] = 255 - r; // Negative Laplacian
            output[idx + 1] = 255 - g;
            output[idx + 2] = 255 - b;
            output[idx + 3] = data[idx + 3]; // Alpha channel remains unchanged
        }
    }

    for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
    }

    ctx.putImageData(imageData, 0, 0);

    generateHistogram(imageData);
}


function applyGaussianFilter(sigma = 1.0) {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;
    let width = canvas.width;
    let height = canvas.height;

    let kernelSize = Math.ceil(sigma * 6);
    if (kernelSize % 2 === 0) kernelSize += 1;
    let kernel = createGaussianKernel(kernelSize, sigma);

    let output = new Uint8ClampedArray(data.length);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;
            for (let ky = -Math.floor(kernelSize / 2); ky <= Math.floor(kernelSize / 2); ky++) {
                for (let kx = -Math.floor(kernelSize / 2); kx <= Math.floor(kernelSize / 2); kx++) {
                    let px = Math.min(width - 1, Math.max(0, x + kx));
                    let py = Math.min(height - 1, Math.max(0, y + ky));
                    let weight = kernel[ky + Math.floor(kernelSize / 2)][kx + Math.floor(kernelSize / 2)];
                    let idx = (py * width + px) * 4;
                    r += data[idx] * weight;
                    g += data[idx + 1] * weight;
                    b += data[idx + 2] * weight;
                }
            }
            let idx = (y * width + x) * 4;
            output[idx] = r;
            output[idx + 1] = g;
            output[idx + 2] = b;
            output[idx + 3] = data[idx + 3];
        }
    }

    for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
    }

    ctx.putImageData(imageData, 0, 0);

    generateHistogram(imageData);
}

function createGaussianKernel(size, sigma) {
    let kernel = new Array(size).fill(0).map(() => new Array(size).fill(0));
    let mean = size / 2;
    let sum = 0.0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            kernel[y][x] = Math.exp(-0.5 * (Math.pow((x - mean) / sigma, 2.0) + Math.pow((y - mean) / sigma, 2.0))) / (2 * Math.PI * sigma * sigma);
            sum += kernel[y][x];
        }
    }
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            kernel[y][x] /= sum;
        }
    }
    return kernel;
}


function applyHistogramEqualization() {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;
    let hist = new Array(256).fill(0);
    let cdf = new Array(256).fill(0);
    let equalizedData = new Array(data.length);

    // Step 1: Compute the histogram
    for (let i = 0; i < data.length; i += 4) {
        let grayscale = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        hist[grayscale]++;
    }

    // Step 2: Compute the CDF
    cdf[0] = hist[0];
    for (let i = 1; i < hist.length; i++) {
        cdf[i] = cdf[i - 1] + hist[i];
    }

    // Step 3: Normalize the CDF
    let cdfMin = cdf.find(value => value > 0);
    let totalPixels = canvas.width * canvas.height;
    for (let i = 0; i < cdf.length; i++) {
        cdf[i] = Math.round((cdf[i] - cdfMin) / (totalPixels - cdfMin) * 255);
    }

    // Step 4: Map the original pixel values to the equalized values
    for (let i = 0; i < data.length; i += 4) {
        let grayscale = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        let equalizedValue = cdf[grayscale];
        equalizedData[i] = equalizedValue;
        equalizedData[i + 1] = equalizedValue;
        equalizedData[i + 2] = equalizedValue;
        equalizedData[i + 3] = data[i + 3]; // Alpha channel remains unchanged
    }

    // Step 5: Update the image data with the equalized values
    for (let i = 0; i < data.length; i++) {
        data[i] = equalizedData[i];
    }

    ctx.putImageData(imageData, 0, 0);

    generateHistogram(imageData);
}


function applyExponentialEqualization() {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;
    const constant = 1.0; 

    let maxVal = 0;
    for (let i = 0; i < data.length; i += 4) {
        maxVal = Math.max(data[i], data[i+1], data[i+2], maxVal);
    }

    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 * (1 - Math.exp(-constant * data[i] / maxVal)); // red
        data[i + 1] = 255 * (1 - Math.exp(-constant * data[i + 1] / maxVal)); // green
        data[i + 2] = 255 * (1 - Math.exp(-constant * data[i + 2] / maxVal)); // blue
    }

    ctx.putImageData(imageData, 0, 0);

    generateHistogram(imageData);
}

function resetFilters() {
    if (originalImageData) {
        ctx.putImageData(originalImageData, 0, 0);
    }
}

function generateHistogram(imageData) {
    let greyFrequencies = new Array(256).fill(0);
    let data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        let grayscale = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        greyFrequencies[grayscale]++;
    }

    var options = {
        series: [{
            name: 'Intensidad de Gris',
            data: greyFrequencies
        }],
        chart: {
            type: 'bar', 
            height: 350
        },
        title: {
            text: 'Histograma de Intensidad de Gris',
            align: 'left'
        },
        xaxis: {
            categories: [...Array(256).keys()],
            labels: {
                show: false, // This hides the labels
            },
            title: {
                text: 'Intensidad de Gris'
            }
        },
        yaxis: {
            title: {
                text: 'Frecuencia'
            }
        },
        tooltip: {
            shared: true,
            intersect: false
        },
        dataLabels: {
            enabled: false
        },
    };

    if (window.chart) {
        window.chart.updateOptions(options);
    } else {
        window.chart = new ApexCharts(document.querySelector("#chart"), options);
        window.chart.render();
    }
}


function applySobelFilter() {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;
    let width = imageData.width;
    let height = imageData.height;

    // Kernels de Sobel

    let sobelX = [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
    ];

    let sobelY = [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1]
    ];

    let grayscaleData = [];
    for (let i = 0; i < data.length; i += 4) {
        grayscaleData.push(data[i]);
    }

    let gradientData = new Uint8ClampedArray(data.length);

    function getPixel(x, y) {
        return grayscaleData[y * width + x];
    }

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let pixelX = (
                (sobelX[0][0] * getPixel(x - 1, y - 1)) +
                (sobelX[0][1] * getPixel(x, y - 1)) +
                (sobelX[0][2] * getPixel(x + 1, y - 1)) +
                (sobelX[1][0] * getPixel(x - 1, y)) +
                (sobelX[1][2] * getPixel(x + 1, y)) +
                (sobelX[2][0] * getPixel(x - 1, y + 1)) +
                (sobelX[2][1] * getPixel(x, y + 1)) +
                (sobelX[2][2] * getPixel(x + 1, y + 1))
            );

            let pixelY = (
                (sobelY[0][0] * getPixel(x - 1, y - 1)) +
                (sobelY[0][1] * getPixel(x, y - 1)) +
                (sobelY[0][2] * getPixel(x + 1, y - 1)) +
                (sobelY[1][0] * getPixel(x - 1, y)) +
                (sobelY[1][2] * getPixel(x + 1, y)) +
                (sobelY[2][0] * getPixel(x - 1, y + 1)) +
                (sobelY[2][1] * getPixel(x, y + 1)) +
                (sobelY[2][2] * getPixel(x + 1, y + 1))
            );

            let magnitude = Math.sqrt((pixelX * pixelX) + (pixelY * pixelY)) >>> 0;

            let index = (y * width + x) * 4;
            gradientData[index] = gradientData[index + 1] = gradientData[index + 2] = magnitude;
            gradientData[index + 3] = 255; // Alpha channel
        }
    }

    ctx.putImageData(new ImageData(gradientData, width, height), 0, 0);
    generateHistogram(imageData);
}
