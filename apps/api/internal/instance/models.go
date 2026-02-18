package instance

type InstanceInfo struct {
	Name             string  `json:"name"`
	IconURL          *string `json:"iconUrl"`
	Description      *string `json:"description"`
	Version          string  `json:"version"`
	RegistrationOpen bool    `json:"registrationOpen"`
	AuthServerURL    *string `json:"authServerUrl"`
}

type UpdateInstanceRequest struct {
	Name             *string `json:"name"`
	IconURL          *string `json:"iconUrl"`
	Description      *string `json:"description"`
	RegistrationOpen *bool   `json:"registrationOpen"`
}
