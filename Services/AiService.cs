using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;

namespace Docuan.Services
{
    public class AiService
    {
        private readonly IConfiguration _configuration;

        public AiService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<string> GetAiResponse(string text, string model)
        {
            var aiSettings = _configuration.GetSection("AiSettings").Get<Dictionary<string, AiModelSettings>>();
            var settings = aiSettings[model];

            using (var client = new HttpClient())
            {
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {settings.ApiKey}");

                var request = new
                {
                    model = settings.Model,
                    messages = new[]
                    {
                        new { role = "system", content = "Analisis teks hasil OCR" },
                        new { role = "user", content = text }
                    }
                };

                var content = new StringContent(JsonConvert.SerializeObject(request), Encoding.UTF8,
                    "application/json");
                var response = await client.PostAsync($"{settings.BaseUrl}/chat/completions", content);

                if (response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    var responseJson = JsonConvert.DeserializeObject<dynamic>(responseContent);
                    return responseJson.choices[0].message.content;
                }
                else
                {
                    throw new Exception($"AI API request failed with status code: {response.StatusCode}");
                }
            }
        }
    }

    public class AiModelSettings
    {
        public string ApiKey { get; set; }
        public string Model { get; set; }
        public string BaseUrl { get; set; }
    }
}